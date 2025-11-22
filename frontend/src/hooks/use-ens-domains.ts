import { useCallback, useEffect, useMemo, useState } from 'react'

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
                id: string
                name: string
                labelName?: string | null
                labelhash?: string | null
                isMigrated?: boolean | null
                expiryDate?: string | null
                createdAt?: string | null
            }
        }>
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
          name
          labelhash
          labelName
          isMigrated
          id
          expiryDate
          createdAt
        }
      }
    }
  }
`

async function fetchEnsDomains(ownerAddress: string): Promise<EnsDomain[]> {
    const normalizedAddress = ownerAddress.toLowerCase()

    const apiKey = import.meta.env.VITE_THEGRAPH_API_KEY
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    }

    if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`
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

    // Extract domains from wrappedDomains
    const accounts = json.data?.accounts ?? []
    const allDomains: Array<{
        id: string
        name: string
        labelName?: string | null
        expiryDate?: string | null
    }> = []

    for (const account of accounts) {
        for (const wrappedDomain of account.wrappedDomains) {
            const domain = wrappedDomain.domain
            if (domain.name?.endsWith('.eth')) {
                allDomains.push({
                    id: domain.id,
                    name: domain.name,
                    labelName: domain.labelName,
                    expiryDate: domain.expiryDate,
                })
            }
        }
    }

    console.log('[fetchEnsDomains] Subgraph response:', {
        accountsCount: accounts.length,
        totalDomainsCount: allDomains.length,
        address: normalizedAddress,
        rawData: json.data,
    })

    // Deduplicate by domain ID
    const domainMap = new Map<string, (typeof allDomains)[0]>()

    for (const domain of allDomains) {
        if (domain.id && domain.name?.endsWith('.eth')) {
            domainMap.set(domain.id, domain)
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
