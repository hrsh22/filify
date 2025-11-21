import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Github, Globe, Rocket, ShieldCheck, Workflow } from 'lucide-react'
import { SignInButton } from '@/components/auth/sign-in-button'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/auth-context'

const steps = [
  { title: 'Connect GitHub', description: 'Authorize FilShip to access your repositories securely.' },
  { title: 'Create a project', description: 'Pick a repo, choose a branch, and configure ENS + RPC details.' },
  { title: 'Deploy with one click', description: 'FilShip clones, builds, and uploads your project to Filecoin.' },
  { title: 'Serve via ENS', description: 'We update your ENS domain so your site is live on the decentralized web.' },
]

const features = [
  { icon: <Github className="h-5 w-5" />, title: 'GitHub OAuth', description: 'Use your existing GitHub identity to sign in and link repositories.' },
  { icon: <Workflow className="h-5 w-5" />, title: 'Vercel-like workflow', description: 'Cloning, building, and deploying all happen automatically.' },
  { icon: <Globe className="h-5 w-5" />, title: 'Filecoin + ENS', description: 'Upload to Filecoin and publish via ENS contenthash updates.' },
  { icon: <ShieldCheck className="h-5 w-5" />, title: 'Secure storage', description: 'Secrets stay on the backend. Frontend never stores private keys.' },
]

export function LandingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    if (user) {
      navigate('/dashboard')
    }
  }, [user, navigate])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-16 md:gap-20 md:px-6">
        <section className="grid gap-8 md:grid-cols-[1fr,300px] md:items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 px-4 py-1 text-sm text-muted-foreground">
              <Rocket className="h-4 w-4 text-foreground" />
              Filecoin Pin + ENS deployments
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Deploy to the decentralized web with one click
            </h1>
            <p className="text-lg text-muted-foreground">
              FilShip gives you a Vercel-like dashboard powered by Filecoin storage and ENS domains. Connect GitHub, pick a repo, and launch in minutes.
            </p>
            <div className="flex flex-wrap gap-3">
              <SignInButton size="lg" className="min-w-[200px]" />
              <Button size="lg" variant="outline" onClick={() => navigate('/dashboard')} disabled={!user}>
                View dashboard
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Built for builders who care about permanence, provenance, and ownership.
            </p>
          </div>
          <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-lg">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">How it works</p>
            <ul className="mt-4 space-y-4 text-sm text-muted-foreground">
              {steps.map((step) => (
                <li key={step.title} className="rounded-2xl border border-dashed border-border/70 px-4 py-3">
                  <p className="font-semibold text-foreground">{step.title}</p>
                  <p>{step.description}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="grid gap-6 rounded-3xl border border-border/70 bg-card/60 p-6 md:grid-cols-2">
          {features.map((feature) => (
            <div key={feature.title} className="space-y-3 rounded-2xl border border-border/60 bg-background/60 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground">{feature.icon}</div>
              <h3 className="text-lg font-semibold">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}


