import { useCallback, useEffect, useMemo, useState } from 'react'
import { API_URL } from '@/utils/constants'

export interface EnsDomain {
    name: string
    label?: string | null
    expiry?: Date | null
}

interface BackendEnsDomain {
    name: string
    label?: string | null
    expiry?: string | null // ISO date string from backend
}

async function fetchEnsDomains(ownerAddress: string): Promise<EnsDomain[]> {
    const normalizedAddress = ownerAddress.toLowerCase()

    console.log('[fetchEnsDomains] Fetching from backend:', normalizedAddress)

    const response = await fetch(`${API_URL}/ens/domains/${normalizedAddress}`, {
        method: 'GET',
        credentials: 'include',
    })

    console.log('[fetchEnsDomains] Response:', response)

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('[fetchEnsDomains] Backend request failed:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
            address: normalizedAddress,
        })
        throw new Error(errorData.error ?? `Failed to query ENS domains: ${response.statusText}`)
    }

    const json = await response.json() as { domains: BackendEnsDomain[] }

    console.log('[fetchEnsDomains] Backend response:', {
        domainsCount: json.domains?.length ?? 0,
        address: normalizedAddress,
    })

    return (json.domains ?? []).map((domain) => ({
        name: domain.name,
        label: domain.label,
        expiry: domain.expiry ? new Date(domain.expiry) : null,
    }))
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
