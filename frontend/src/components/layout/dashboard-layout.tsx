import { Outlet } from 'react-router-dom'
import { AppHeader } from '@/components/navigation/app-header'

export function DashboardLayout() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
        <Outlet />
      </main>
    </div>
  )
}


