import { Request, Response } from 'express';
import { env } from '../config/env';
import { logger } from '../utils/logger';

// The Graph ENS subgraph endpoint
const ENS_MAINNET_SUBGRAPH =
    'https://gateway.thegraph.com/api/subgraphs/id/5XqPmWe6gjyrJtFn9cLy237i4cWw2j9HcUJEXsP5qGtH';

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

class EnsController {
    /**
     * GET /api/ens/domains/:address
     * Fetch ENS domains owned by an address via The Graph subgraph
     */
    async getDomains(req: Request, res: Response) {
        const { address } = req.params;

        if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
            return res.status(400).json({ error: 'Invalid Ethereum address' });
        }

        const normalizedAddress = address.toLowerCase();

        try {
            logger.info('Fetching ENS domains', { address: normalizedAddress });

            const response = await fetch(ENS_MAINNET_SUBGRAPH, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${env.THEGRAPH_API_KEY}`,
                },
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

        return uniqueDomains
            .map((domain) => {
                const expiryTimestamp = domain.expiryDate ? Number(domain.expiryDate) : null;
                return {
                    name: domain.name,
                    label: domain.labelName,
                    expiry: expiryTimestamp ? new Date(expiryTimestamp * 1000).toISOString() : null,
                };
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    }
}

export const ensController = new EnsController();
