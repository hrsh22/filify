import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppKitAccount } from '@reown/appkit/react'
import { Github, Globe, Rocket, ShieldCheck, Workflow, Zap, CheckCircle2, ArrowRight, Sparkles } from 'lucide-react'
import { SignInButton } from '@/components/auth/sign-in-button'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/auth-context'
import { WalletConnectButton } from '@/components/auth/wallet-connect-button'

const steps = [
  { icon: Github, title: 'Connect GitHub', description: 'Authorize Filify to access your repositories securely.', color: 'text-primary' },
  { icon: Zap, title: 'Create a project', description: 'Pick a repo, choose a branch, and configure ENS + RPC details.', color: 'text-cyan' },
  { icon: Rocket, title: 'Deploy with one click', description: 'Filify clones, builds, and uploads your project to Filecoin.', color: 'text-blue' },
  { icon: CheckCircle2, title: 'Serve via ENS', description: 'We update your ENS domain so your site is live on the decentralized web.', color: 'text-primary' },
]

const features = [
  { icon: Github, title: 'GitHub OAuth', description: 'Use your existing GitHub identity to sign in and link repositories.', bgColor: 'bg-primary', borderColor: 'border-primary' },
  { icon: Workflow, title: 'Vercel-like workflow', description: 'Cloning, building, and deploying all happen automatically.', bgColor: 'bg-cyan', borderColor: 'border-cyan' },
  { icon: Globe, title: 'Filecoin + ENS', description: 'Upload to Filecoin and publish via ENS contenthash updates.', bgColor: 'bg-blue', borderColor: 'border-blue' },
  { icon: ShieldCheck, title: 'Secure storage', description: 'Secrets stay on the backend. Frontend never stores private keys.', bgColor: 'bg-primary', borderColor: 'border-primary' },
]

export function LandingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isConnected } = useAppKitAccount()

  useEffect(() => {
    if (user) {
      navigate('/dashboard')
    }
  }, [user, navigate])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-16 px-4 py-20 md:gap-24 md:px-8">
        {/* Hero Section */}
        <section className="grid gap-12 md:grid-cols-[1.2fr,0.8fr] md:items-center animate-fade-in">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2.5 rounded-lg bg-primary border border-primary px-5 py-2.5 text-sm font-bold text-black shadow-neo-sm">
              <Sparkles className="h-4 w-4" />
              Filecoin Pin + ENS deployments
            </div>
            <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl leading-tight">
              Deploy to the{' '}
              <span className="text-cyan">
                decentralized web
              </span>{' '}
              with one click
            </h1>
            <p className="text-xl font-medium text-muted-foreground leading-relaxed">
              Filify gives you a Vercel-like dashboard powered by Filecoin storage and ENS domains. Connect GitHub, pick a repo, and launch in minutes.
            </p>
            <div className="flex flex-wrap gap-4">
              <WalletConnectButton size="lg" className="min-w-[220px] shadow-neo hover:shadow-neo-lg" />
              <SignInButton size="lg" className="min-w-[220px] shadow-neo hover:shadow-neo-lg" />
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate('/dashboard')}
                disabled={!user}
                className="min-w-[180px]"
              >
                View dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm font-semibold text-muted-foreground">
              {isConnected ? 'Wallet connected — continue with GitHub to unlock the dashboard.' : 'Step 1 · Connect your wallet to enable GitHub sign-in.'}
            </p>
            <p className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-cyan" />
              Built for builders who care about permanence, provenance, and ownership.
            </p>
          </div>
          
          {/* Steps Card */}
          <div className="rounded-xl bg-card border border-border p-8 shadow-neo-lg hover-lift">
            <div className="flex items-center gap-2 mb-6">
              <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-neo-sm">
                <Zap className="h-4 w-4 text-white" />
              </div>
              <p className="text-sm font-bold uppercase tracking-wide text-primary">How it works</p>
            </div>
            <ul className="space-y-5">
              {steps.map((step, index) => (
                <li key={step.title} className="group rounded-lg bg-card border border-border p-5 shadow-neo-sm transition-neo hover:shadow-neo hover:border-primary hover:-translate-y-1">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-card border border-border shadow-neo-sm group-hover:shadow-neo group-hover:border-primary transition-neo">
                      <step.icon className={`h-5 w-5 ${step.color}`} />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground">Step {index + 1}</span>
                      </div>
                      <p className="font-bold text-foreground">{step.title}</p>
                      <p className="text-sm font-medium text-muted-foreground leading-relaxed">{step.description}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Features Section */}
        <section className="space-y-8 animate-fade-in">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-bold text-foreground">Powerful features for modern deployment</h2>
            <p className="text-lg text-muted-foreground">Everything you need to deploy with confidence</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div 
                key={feature.title} 
                className="group space-y-4 rounded-xl bg-card border border-border p-6 shadow-neo transition-neo hover:shadow-neo-lg hover:border-primary hover:-translate-y-2"
              >
                <div className={`flex h-14 w-14 items-center justify-center rounded-lg ${feature.bgColor} ${feature.borderColor} border text-black shadow-neo-sm group-hover:shadow-neo transition-neo`}>
                  <feature.icon className="h-7 w-7" />
                </div>
                <h3 className="text-lg font-bold text-foreground">{feature.title}</h3>
                <p className="text-sm font-medium text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="rounded-xl bg-primary border border-primary p-12 text-center shadow-neo-xl animate-fade-in">
          <div className="mx-auto max-w-2xl space-y-6">
            <h2 className="text-3xl font-bold text-black">Ready to get started?</h2>
            <p className="text-lg text-black/80">
              Join developers building on the decentralized web with Filecoin and ENS.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <WalletConnectButton
                size="lg"
                className="min-w-[220px] bg-black text-white hover:bg-black/90 shadow-neo border-black"
              />
              <SignInButton
                size="lg"
                variant="secondary"
                className="min-w-[240px] bg-black text-white hover:bg-black/90 shadow-neo border-black"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}


