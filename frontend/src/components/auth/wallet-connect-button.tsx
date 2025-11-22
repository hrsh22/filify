import { Wallet } from 'lucide-react'
import { useAppKit, useAppKitAccount } from '@reown/appkit/react'
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
  const computedVariant = variant ?? (isConnected ? 'secondary' : 'default')

  const label = isConnected ? `Wallet · ${formatAddress(address)}` : 'Connect wallet'

  return (
    <Button type="button" variant={computedVariant} onClick={() => void open()} {...props}>
      <Wallet className="h-5 w-5" />
      {label}
    </Button>
  )
}


