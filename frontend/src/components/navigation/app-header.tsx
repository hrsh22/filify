import { Link, NavLink } from 'react-router-dom'
import { Sparkles, LogOut, User as UserIcon, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { useAuth } from '@/context/auth-context'
import { SignOutButton } from '@/components/auth/sign-out-button'
import { WalletConnectButton } from '@/components/auth/wallet-connect-button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/projects/new', label: 'New project' },
]

export function AppHeader() {
  const { user } = useAuth()

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
