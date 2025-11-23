import { useCallback, useEffect, useMemo, useState } from 'react'
import { THEGRAPH_API_KEY } from '@/utils/constants'

export interface EnsDomain {
    name: string
    label?: string | null
    expiry?: Date | null
}

interface EnsDomainQueryResult {
    accounts: Array<{
        id: string
        wrappedDomains: Array<{
            domain: {
                id?: string | null
                name: string
                labelName?: string | null
                labelhash?: string | null
                isMigrated?: boolean | null
                expiryDate?: string | null
                createdAt?: string | null
            }
        }>
    }>
    domains: Array<{
        id?: string | null
        name: string
        labelName?: string | null
        expiryDate?: string | null
        createdAt?: string | null
    }>
    registrations: Array<{
        id: string
        expiryDate?: string | null
        registrationDate?: string | null
        domain: {
            id?: string | null
            name: string
            labelName?: string | null
            expiryDate?: string | null
            createdAt?: string | null
        }
    }>
}

// Using the official ENS subgraph endpoint
const ENS_MAINNET_SUBGRAPH =
    'https://gateway.thegraph.com/api/subgraphs/id/5XqPmWe6gjyrJtFn9cLy237i4cWw2j9HcUJEXsP5qGtH'
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
`


async function fetchEnsDomains(ownerAddress: string): Promise<EnsDomain[]> {
    const normalizedAddress = ownerAddress.toLowerCase()

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    }

    if (THEGRAPH_API_KEY) {
        headers.Authorization = `Bearer ${THEGRAPH_API_KEY}`
    }

    const response = await fetch(ENS_MAINNET_SUBGRAPH, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            query: ENS_DOMAINS_QUERY,
            variables: {
                owner: normalizedAddress,
            },
        }),
    })

    console.log('[fetchEnsDomains] Response:', response)

    if (!response.ok) {
        const errorText = await response.text()
        console.error('[fetchEnsDomains] Subgraph request failed:', {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
            address: normalizedAddress,
        })
        throw new Error(`Failed to query ENS subgraph: ${response.statusText}`)
    }

    const json = (await response.json()) as { data?: EnsDomainQueryResult; errors?: Array<{ message: string }> }

    if (json.errors?.length) {
        throw new Error(json.errors[0]?.message ?? 'ENS subgraph returned an error')
    }

    const accounts = json.data?.accounts ?? []
    const ownedDomains = json.data?.domains ?? []
    const registrations = json.data?.registrations ?? []

    type RawDomain = {
        id: string
        name: string
        labelName?: string | null
        expiryDate?: string | null
    }

    const collectedDomains: RawDomain[] = []

    const collectDomain = (
        domain: {
            id?: string | null
            name?: string | null
            labelName?: string | null
            expiryDate?: string | null
        },
        fallbackExpiry?: string | null
    ) => {
        if (!domain?.name?.endsWith('.eth')) {
            return
        }

        const id = domain.id ?? domain.name
        if (!id || !domain.name) {
            return
        }

        collectedDomains.push({
            id,
            name: domain.name,
            labelName: domain.labelName,
            expiryDate: domain.expiryDate ?? fallbackExpiry ?? null,
        })
    }

    for (const account of accounts) {
        for (const wrappedDomain of account.wrappedDomains) {
            collectDomain(wrappedDomain.domain)
        }
    }

    for (const domain of ownedDomains) {
        collectDomain(domain)
    }

    for (const registration of registrations) {
        collectDomain(registration.domain, registration.expiryDate)
    }

    console.log('[fetchEnsDomains] Subgraph response:', {
        accountsCount: accounts.length,
        wrappedDomainsCount: accounts.reduce((total, account) => total + account.wrappedDomains.length, 0),
        ownedDomainsCount: ownedDomains.length,
        registrationsCount: registrations.length,
        totalCollected: collectedDomains.length,
        address: normalizedAddress,
    })

    const domainMap = new Map<string, RawDomain>()

    for (const domain of collectedDomains) {
        if (!domain.id || !domain.name) {
            continue
        }

        const existing = domainMap.get(domain.id)

        if (!existing) {
            domainMap.set(domain.id, domain)
            continue
        }

        const hasBetterExpiry = !existing.expiryDate && !!domain.expiryDate
        const hasBetterLabel = !existing.labelName && !!domain.labelName

        if (hasBetterExpiry || hasBetterLabel) {
            domainMap.set(domain.id, {
                ...existing,
                expiryDate: hasBetterExpiry ? domain.expiryDate : existing.expiryDate,
                labelName: hasBetterLabel ? domain.labelName : existing.labelName,
            })
        }
    }

    const uniqueDomains = Array.from(domainMap.values())

    console.log(
        '[fetchEnsDomains] Unique domains found:',
        uniqueDomains.length,
        uniqueDomains.map((d) => d.name)
    )

    return uniqueDomains
        .map((domain) => {
            const expiryTimestamp = domain.expiryDate ? Number(domain.expiryDate) : null
            return {
                name: domain.name,
                label: domain.labelName,
                expiry: expiryTimestamp ? new Date(expiryTimestamp * 1000) : null,
            }
        })
        .sort((a, b) => {
            // Sort by name alphabetically
            return a.name.localeCompare(b.name)
        })
}

export function useEnsDomains(ownerAddress: string | null | undefined) {
    const [domains, setDomains] = useState<EnsDomain[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const normalizedOwner = ownerAddress?.toLowerCase() ?? null

    console.log('[useEnsDomains] Hook initialized/updated', {
        ownerAddress,
        normalizedOwner,
        hasOwner: !!normalizedOwner,
    })

    const fetchDomains = useCallback(async () => {
        console.log('[useEnsDomains] fetchDomains called', { normalizedOwner, hasOwner: !!normalizedOwner })

        if (!normalizedOwner) {
            console.log('[useEnsDomains] No owner address, clearing domains')
            setDomains([])
            setError(null)
            setLoading(false)
            return
        }

        try {
            console.log('[useEnsDomains] Fetching ENS domains for:', normalizedOwner)
            setLoading(true)
            const results = await fetchEnsDomains(normalizedOwner)
            console.log('[useEnsDomains] Fetched domains:', results.length, results)
            setDomains(results)
            setError(null)
        } catch (err) {
            console.error('[useEnsDomains] Error fetching domains:', err)
            setDomains([])
            setError('Unable to load ENS domains for this wallet')
        } finally {
            setLoading(false)
        }
    }, [normalizedOwner])

    useEffect(() => {
        void fetchDomains()
    }, [fetchDomains])

    const metadata = useMemo(
        () => ({
            hasDomains: domains.length > 0,
            lastUpdated: domains.length > 0 ? new Date() : null,
        }),
        [domains]
    )

    return {
        domains,
        loading,
        error,
        metadata,
        refresh: fetchDomains,
    }
}
