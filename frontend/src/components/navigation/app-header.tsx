import { Link, NavLink } from 'react-router-dom'
import { Sparkles, LogOut, Wallet, Globe } from 'lucide-react'
import { useSwitchChain, useAccount } from 'wagmi'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { useAuth } from '@/context/auth-context'
import { useNetwork, type Network } from '@/context/network-context'
import { SignOutButton } from '@/components/auth/sign-out-button'
import { WalletConnectButton } from '@/components/auth/wallet-connect-button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu'

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/projects/new', label: 'New project' },
]

// Chain IDs
const CHAIN_IDS = {
  mainnet: 1,
  sepolia: 11155111,
} as const

export function AppHeader() {
  const { user } = useAuth()
  const { network, setNetwork, chainId } = useNetwork()
  const { switchChain } = useSwitchChain()
  const { isConnected } = useAccount()

  const handleNetworkChange = async (newNetwork: string) => {
    const targetNetwork = newNetwork as Network

    // If wallet is connected, prompt to switch chain first
    if (isConnected && switchChain) {
      try {
        await switchChain({ chainId: CHAIN_IDS[targetNetwork] })
        // Only update context after successful wallet switch
        setNetwork(targetNetwork)
      } catch (error) {
        console.error('[AppHeader] Failed to switch chain:', error)
        // User rejected - don't update app context
      }
    } else {
      // No wallet connected, just update context
      setNetwork(targetNetwork)
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-8">
          <Link to="/dashboard" className="flex items-center gap-2.5 text-lg font-semibold transition-smooth hover:opacity-80">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="hidden sm:inline-block">Filify</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  isActive
                    ? 'rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-smooth'
                    : 'rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-smooth hover:bg-secondary/50 hover:text-foreground'
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {/* Network Toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Globe className="h-4 w-4" />
                <span className="hidden sm:inline">{network === 'mainnet' ? 'Mainnet' : 'Sepolia'}</span>
                {network === 'sepolia' && (
                  <span className="inline-flex items-center rounded-full bg-amber-500/10 px-1.5 py-0.5 text-xs font-medium text-amber-500">
                    Test
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Network</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={network} onValueChange={handleNetworkChange}>
                <DropdownMenuRadioItem value="mainnet">
                  <div className="flex flex-col">
                    <span>Ethereum Mainnet</span>
                    <span className="text-xs text-muted-foreground">Production network</span>
                  </div>
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="sepolia">
                  <div className="flex flex-col">
                    <span>Sepolia Testnet</span>
                    <span className="text-xs text-muted-foreground">For testing only</span>
                  </div>
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {user ? (
            <>
              <WalletConnectButton size="sm" variant="outline" className="hidden md:inline-flex" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.avatarUrl ?? undefined} alt={user.githubUsername} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                        {user.githubUsername.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.githubUsername}</p>
                      <p className="text-xs leading-none text-muted-foreground">GitHub User</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="md:hidden" asChild>
                    <div className="flex items-center gap-2 cursor-pointer">
                      <Wallet className="h-4 w-4" />
                      <span>Wallet</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <SignOutButton variant="ghost" className="w-full justify-start p-0 h-auto font-normal">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </SignOutButton>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button asChild size="sm">
              <Link to="/">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
