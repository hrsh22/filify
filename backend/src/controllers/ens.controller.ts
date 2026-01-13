import { Request, Response } from 'express';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { getNetworkConfig, isValidNetwork, type NetworkType } from '../config/network-config';

const ENS_DOMAINS_QUERY = /* GraphQL */ `
    query EnsDomains($owner: Bytes!) {
        accounts(where: { id: $owner }) {
            id
            wrappedDomains {
                domain {
                    id
                    name
                    labelhash
                    labelName
                    isMigrated
                    expiryDate
                    createdAt
                }
            }
        }
        domains(where: { owner: $owner }) {
            id
            name
            labelName
            expiryDate
            createdAt
        }
        registrations(where: { registrant: $owner }) {
            id
            expiryDate
            registrationDate
            domain {
                id
                name
                labelName
                expiryDate
                createdAt
            }
        }
    }
`;

interface EnsDomainQueryResult {
    accounts: Array<{
        id: string;
        wrappedDomains: Array<{
            domain: {
                id?: string | null;
                name: string;
                labelName?: string | null;
                labelhash?: string | null;
                isMigrated?: boolean | null;
                expiryDate?: string | null;
                createdAt?: string | null;
            };
        }>;
    }>;
    domains: Array<{
        id?: string | null;
        name: string;
        labelName?: string | null;
        expiryDate?: string | null;
        createdAt?: string | null;
    }>;
    registrations: Array<{
        id: string;
        expiryDate?: string | null;
        registrationDate?: string | null;
        domain: {
            id?: string | null;
            name: string;
            labelName?: string | null;
            expiryDate?: string | null;
            createdAt?: string | null;
        };
    }>;
}

export interface EnsDomain {
    name: string;
    label?: string | null;
    expiry?: string | null; // ISO date string
}

interface CacheEntry {
    domains: EnsDomain[];
    timestamp: number;
}

const CACHE_TTL_MS = 60 * 1000; // 1 minute cache
const ensDomainsCache = new Map<string, CacheEntry>();

class EnsController {
    async getDomains(req: Request, res: Response) {
        const { address } = req.params;
        const networkParam = req.query.network as string | undefined;
        const network: NetworkType = networkParam && isValidNetwork(networkParam) ? networkParam : 'mainnet';
        const networkConfig = getNetworkConfig(network);

        if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
            return res.status(400).json({ error: 'Invalid Ethereum address' });
        }

        const normalizedAddress = address.toLowerCase();
        const cacheKey = `${network}:${normalizedAddress}`;
        
        const cached = ensDomainsCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
            logger.debug('Returning cached ENS domains', { address: normalizedAddress, network });
            return res.json({ domains: cached.domains });
        }

        try {
            logger.info('Fetching ENS domains', { address: normalizedAddress, network });

            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            
            if (networkConfig.ensSubgraphUrl.includes('gateway.thegraph.com')) {
                headers['Authorization'] = `Bearer ${env.THEGRAPH_API_KEY}`;
            }

            const response = await fetch(networkConfig.ensSubgraphUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    query: ENS_DOMAINS_QUERY,
                    variables: {
                        owner: normalizedAddress,
                    },
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                logger.error('ENS subgraph request failed', {
                    status: response.status,
                    error: errorText,
                    address: normalizedAddress,
                });
                return res.status(502).json({ error: 'Failed to query ENS subgraph' });
            }

            const json = await response.json() as { data?: EnsDomainQueryResult; errors?: Array<{ message: string }> };

            if (json.errors?.length) {
                logger.error('ENS subgraph returned errors', { errors: json.errors });
                return res.status(502).json({ error: json.errors[0]?.message ?? 'ENS subgraph error' });
            }

            const domains = this.processEnsDomains(json.data, normalizedAddress);
            
            ensDomainsCache.set(cacheKey, { domains, timestamp: Date.now() });

            logger.info('Found ENS domains', { address: normalizedAddress, count: domains.length });

            return res.json({ domains });
        } catch (error) {
            logger.error('Error fetching ENS domains', {
                address: normalizedAddress,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return res.status(500).json({ error: 'Failed to fetch ENS domains' });
        }
    }

    private processEnsDomains(data: EnsDomainQueryResult | undefined, address: string): EnsDomain[] {
        const accounts = data?.accounts ?? [];
        const ownedDomains = data?.domains ?? [];
        const registrations = data?.registrations ?? [];

        type RawDomain = {
            id: string;
            name: string;
            labelName?: string | null;
            expiryDate?: string | null;
        };

        const collectedDomains: RawDomain[] = [];

        const collectDomain = (
            domain: {
                id?: string | null;
                name?: string | null;
                labelName?: string | null;
                expiryDate?: string | null;
            },
            fallbackExpiry?: string | null
        ) => {
            if (!domain?.name?.endsWith('.eth')) {
                return;
            }

            const id = domain.id ?? domain.name;
            if (!id || !domain.name) {
                return;
            }

            collectedDomains.push({
                id,
                name: domain.name,
                labelName: domain.labelName,
                expiryDate: domain.expiryDate ?? fallbackExpiry ?? null,
            });
        };

        for (const account of accounts) {
            for (const wrappedDomain of account.wrappedDomains) {
                collectDomain(wrappedDomain.domain);
            }
        }

        for (const domain of ownedDomains) {
            collectDomain(domain);
        }

        for (const registration of registrations) {
            collectDomain(registration.domain, registration.expiryDate);
        }

        // Deduplicate by id
        const domainMap = new Map<string, RawDomain>();
        for (const domain of collectedDomains) {
            if (!domain.id || !domain.name) continue;

            const existing = domainMap.get(domain.id);
            if (!existing) {
                domainMap.set(domain.id, domain);
                continue;
            }

            const hasBetterExpiry = !existing.expiryDate && !!domain.expiryDate;
            const hasBetterLabel = !existing.labelName && !!domain.labelName;

            if (hasBetterExpiry || hasBetterLabel) {
                domainMap.set(domain.id, {
                    ...existing,
                    expiryDate: hasBetterExpiry ? domain.expiryDate : existing.expiryDate,
                    labelName: hasBetterLabel ? domain.labelName : existing.labelName,
                });
            }
        }

        const uniqueDomains = Array.from(domainMap.values());

        // Build a map of 2LD (second-level domain) -> expiryTimestamp
        // e.g., "harshgupta.eth" -> 1234567890
        // This is used to determine expiry for subnames that don't have their own expiry
        const twoLDExpiryMap = new Map<string, number>();

        for (const domain of uniqueDomains) {
            const parts = domain.name.split('.');
            // 2LD has exactly 2 parts: ["harshgupta", "eth"]
            if (parts.length === 2 && domain.expiryDate) {
                twoLDExpiryMap.set(domain.name, Number(domain.expiryDate));
            }
        }

        // Helper to extract 2LD from any domain name
        // e.g., "next.harshgupta.eth" -> "harshgupta.eth"
        // e.g., "a.b.harshgupta.eth" -> "harshgupta.eth"
        const getTwoLD = (name: string): string => {
            const parts = name.split('.');
            return parts.slice(-2).join('.');
        };

        // Helper to get effective expiry for a domain
        // For 2LDs: use their own expiry
        // For subnames: use their parent 2LD's expiry
        const getEffectiveExpiry = (domain: RawDomain): number | null => {
            if (domain.expiryDate) {
                return Number(domain.expiryDate);
            }
            // For subnames without expiry, look up the 2LD's expiry
            const twoLD = getTwoLD(domain.name);
            return twoLDExpiryMap.get(twoLD) ?? null;
        };

        const nowSeconds = Math.floor(Date.now() / 1000);

        return uniqueDomains
            .filter((domain) => {
                const effectiveExpiry = getEffectiveExpiry(domain);
                // If no expiry found (shouldn't happen for valid domains), keep it
                if (effectiveExpiry === null) return true;
                return effectiveExpiry > nowSeconds;
            })
            .map((domain) => {
                const effectiveExpiry = getEffectiveExpiry(domain);
                return {
                    name: domain.name,
                    label: domain.labelName,
                    expiry: effectiveExpiry ? new Date(effectiveExpiry * 1000).toISOString() : null,
                };
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    }
}

export const ensController = new EnsController();
