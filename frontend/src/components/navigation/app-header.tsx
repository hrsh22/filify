import { Link, NavLink } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { useAuth } from '@/context/auth-context'
import { SignOutButton } from '@/components/auth/sign-out-button'

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/projects/new', label: 'New project' },
]

export function AppHeader() {
  const { user } = useAuth()

  return (
    <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-lg shadow-neo">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5 md:px-8">
        <div className="flex items-center gap-10">
          <Link to="/dashboard" className="flex items-center gap-2 text-xl font-bold transition-neo hover:text-primary">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary border border-primary shadow-neo-sm">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            Filify
          </Link>
          <nav className="hidden items-center gap-3 text-sm font-semibold md:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  isActive
                    ? 'rounded-lg bg-primary border border-primary px-4 py-2.5 font-bold text-primary-foreground shadow-neo-sm transition-neo'
                    : 'rounded-lg px-4 py-2.5 text-muted-foreground transition-neo hover:bg-muted/50 hover:text-foreground hover:shadow-neo-sm'
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <span className="hidden rounded-lg bg-card px-5 py-2.5 text-sm font-semibold text-foreground shadow-neo-sm md:inline-flex">
                {user.githubUsername}
              </span>
              <Avatar src={user.avatarUrl ?? undefined} alt={user.githubUsername} />
              <SignOutButton variant="outline" />
            </>
          ) : (
            <Button asChild size="sm" variant="secondary">
              <Link to="/">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}


