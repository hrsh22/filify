import { Wallet } from 'lucide-react'
import { useAppKit, useAppKitAccount } from '@reown/appkit/react'
import { usePublicClient } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import { Button, type ButtonProps } from '@/components/ui/button'

function formatAddress(address?: string) {
  if (!address) {
    return ''
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function WalletConnectButton({ variant, ...props }: ButtonProps) {
  const { open } = useAppKit()
  const { isConnected, address } = useAppKitAccount()
  const publicClient = usePublicClient()
  const computedVariant = variant ?? (isConnected ? 'secondary' : 'default')

  const { data: ensName } = useQuery({
    queryKey: ['ensName', address],
    queryFn: async () => {
      if (!address || !publicClient) return null
      try {
        return await publicClient.getEnsName({ address: address as `0x${string}` })
      } catch {
        return null
      }
    },
    enabled: isConnected && !!address && !!publicClient,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })

  const displayName = ensName || (address ? formatAddress(address) : '')
  const label = isConnected ? `Wallet · ${displayName}` : 'Connect wallet'

  return (
    <Button type="button" variant={computedVariant} onClick={() => void open()} {...props}>
      <Wallet className="h-5 w-5" />
      {label}
    </Button>
  )
}


