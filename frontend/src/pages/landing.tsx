import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppKitAccount } from "@reown/appkit/react";
import { usePublicClient } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { Github, Globe, Rocket, ShieldCheck, Workflow, Zap, CheckCircle2, ArrowRight } from "lucide-react";
import { SignInButton } from "@/components/auth/sign-in-button";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { WalletConnectButton } from "@/components/auth/wallet-connect-button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

const steps = [
    {
        icon: Github,
        title: "Connect GitHub",
        description: "Authorize Filify to access your repositories securely."
    },
    {
        icon: Zap,
        title: "Create a project",
        description: "Pick a repo, choose a branch, and configure ENS + build settings."
    },
    {
        icon: Rocket,
        title: "Deploy with one click",
        description: "Filify clones, builds, and uploads your project to Filecoin."
    },
    {
        icon: CheckCircle2,
        title: "Serve via ENS",
        description: "We update your ENS domain so your site is live on the decentralized web."
    }
];

const features = [
    {
        icon: Github,
        title: "GitHub OAuth",
        description: "Use your existing GitHub identity to sign in and link repositories."
    },
    {
        icon: Workflow,
        title: "Vercel-like workflow",
        description: "Cloning, building, and deploying all happen automatically."
    },
    {
        icon: Globe,
        title: "Filecoin + ENS",
        description: "Upload to Filecoin and publish via ENS contenthash updates."
    },
    {
        icon: ShieldCheck,
        title: "Secure storage",
        description: "Secrets stay on the backend. Frontend never stores private keys."
    }
];

function formatAddress(address: string) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function LandingPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { isConnected, address } = useAppKitAccount();
    const publicClient = usePublicClient();

    // Fetch ENS name for the connected wallet address
    const { data: ensName } = useQuery({
        queryKey: ["walletEnsName", address],
        queryFn: async () => {
            if (!address || !publicClient) return null;
            try {
                return await publicClient.getEnsName({ address: address as `0x${string}` });
            } catch {
                return null;
            }
        },
        enabled: isConnected && !!address && !!publicClient,
        staleTime: 5 * 60 * 1000 // Cache for 5 minutes
    });

    const walletDisplayName = ensName || (address ? formatAddress(address) : null);

    useEffect(() => {
        if (user) {
            navigate("/dashboard");
        }
    }, [user, navigate]);

    return (
        <div className="min-h-screen bg-background">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-24 px-4 py-16 md:px-8 md:py-24">
                {/* Hero Section */}
                <section className="grid gap-12 md:grid-cols-2 md:items-center animate-fade-in">
                    <div className="space-y-8">
                        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-4 py-1.5 text-sm font-medium text-primary">
                            <Zap className="h-3.5 w-3.5" />
                            Filecoin Pin + ENS deployments
                        </div>
                        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
                            Deploy to the{" "}
                            <span className="bg-gradient-to-r from-primary via-orange-500 to-amber-500 bg-clip-text text-transparent">
                                decentralized web
                            </span>{" "}
                            with one click
                        </h1>
                        <p className="text-xl text-muted-foreground leading-relaxed">
                            Filify gives you a Vercel-like dashboard powered by Filecoin storage and ENS domains. Connect GitHub, pick a repo, and
                            launch in minutes.
                        </p>
                        <div className="flex flex-col gap-4 sm:flex-row">
                            <WalletConnectButton size="lg" className="sm:min-w-[200px]" />
                            <SignInButton size="lg" className="sm:min-w-[200px]" />
                        </div>
                        <div className="flex flex-col gap-3 text-sm">
                            {isConnected && walletDisplayName ? (
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-primary" />
                                    <span className="text-muted-foreground">Connected as</span>
                                    <Badge variant="outline" className="font-mono text-xs">
                                        {walletDisplayName}
                                    </Badge>
                                </div>
                            ) : null}
                            <p className="flex items-center gap-2 text-muted-foreground">
                                {isConnected ? (
                                    <>
                                        <CheckCircle2 className="h-4 w-4 text-primary" />
                                        <span>Wallet connected — continue with GitHub to unlock the dashboard.</span>
                                    </>
                                ) : (
                                    <>
                                        <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center text-xs">
                                            1
                                        </div>
                                        <span>Connect your wallet to enable GitHub sign-in.</span>
                                    </>
                                )}
                            </p>
                            <Separator className="my-2" />
                            <p className="flex items-center gap-2 text-muted-foreground">
                                <CheckCircle2 className="h-4 w-4 text-primary" />
                                Built for builders who care about permanence, provenance, and ownership.
                            </p>
                        </div>
                    </div>

                    {/* Steps Card */}
                    <Card className="hover-lift">
                        <CardContent className="p-6 space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-soft">
                                    <Rocket className="h-5 w-5" />
                                </div>
                                <h3 className="text-lg font-semibold">How it works</h3>
                            </div>
                            <div className="space-y-4">
                                {steps.map((step, index) => (
                                    <div
                                        key={step.title}
                                        className="group flex items-start gap-4 rounded-lg border p-4 transition-smooth hover:border-primary/50 hover:bg-accent/50">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary border transition-smooth group-hover:border-primary/50 group-hover:bg-primary/10">
                                            <step.icon className="h-5 w-5 text-primary" />
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-medium text-muted-foreground">Step {index + 1}</span>
                                            </div>
                                            <p className="font-semibold text-sm">{step.title}</p>
                                            <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* Features Section */}
                <section className="space-y-12 animate-fade-in">
                    <div className="text-center space-y-4">
                        <h2 className="text-4xl font-bold">Powerful features for modern deployment</h2>
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Everything you need to deploy with confidence</p>
                    </div>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                        {features.map((feature) => (
                            <Card key={feature.title} className="hover-lift transition-smooth">
                                <CardContent className="p-6 space-y-4">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                        <feature.icon className="h-6 w-6" />
                                    </div>
                                    <h3 className="text-lg font-semibold">{feature.title}</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </section>

                {/* CTA Section */}
                <section className="rounded-2xl bg-gradient-to-br from-primary via-orange-600 to-amber-600 p-12 text-center shadow-elevated animate-fade-in glow-primary">
                    <div className="mx-auto max-w-2xl space-y-6">
                        <h2 className="text-4xl font-bold text-black">Ready to get started?</h2>
                        <p className="text-lg text-black/80">Join developers building on the decentralized web with Filecoin and ENS.</p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <WalletConnectButton size="lg" className="sm:min-w-[220px] bg-black text-white hover:bg-black/90 border-black" />
                            <SignInButton
                                size="lg"
                                variant="secondary"
                                className="sm:min-w-[240px] bg-black text-white hover:bg-black/90 border-black"
                            />
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
