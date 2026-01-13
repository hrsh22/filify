import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAppKitAccount } from "@reown/appkit/react";
import { usePublicClient } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import type { RepositorySummary } from "@/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, ExternalLink, Github, Settings } from "lucide-react";
import { useToast } from "@/context/toast-context";
import { useNetwork } from "@/context/network-context";
import { useNavigate } from "react-router-dom";
import { projectsService } from "@/services/projects.service";
import { deploymentsService } from "@/services/deployments.service";
import { useRepositories, useBranches } from "@/hooks/use-repositories";
import { useEnsDomains } from "@/hooks/use-ens-domains";
import { api } from "@/services/api";

const schema = z
    .object({
        name: z.string().min(1, "Project name is required"),
        repoName: z.string().min(1, "Repository is required"),
        repoUrl: z.string().url(),
        repoBranch: z.string().min(1, "Branch is required"),
        framework: z.enum(["html", "nextjs", "vite", "nuxt"], { required_error: "Framework is required" }),
        enableEns: z.boolean().default(true),
        ensName: z.string().optional(),
        ensOwnerAddress: z.string().optional(),
        buildCommand: z.string().optional(),
        outputDir: z.string().optional(),
        frontendDir: z.string().optional()
    })
    .refine(
        (data) => {
            // If ENS is enabled, ensName and ensOwnerAddress are required
            if (data.enableEns) {
                return !!data.ensName && /^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/.test(data.ensName);
            }
            return true;
        },
        {
            message: "Valid ENS domain (.eth) is required when ENS is enabled",
            path: ["ensName"]
        }
    )
    .refine(
        (data) => {
            if (data.enableEns) {
                return !!data.ensOwnerAddress && /^0x[a-fA-F0-9]{40}$/.test(data.ensOwnerAddress);
            }
            return true;
        },
        {
            message: "Wallet address is required when ENS is enabled",
            path: ["ensOwnerAddress"]
        }
    )
    .refine(
        (data) => {
            // Build config required for Next.js and Nuxt
            if (data.framework === "nextjs" || data.framework === "nuxt") {
                return !!(data.buildCommand && data.outputDir);
            }
            return true;
        },
        {
            message: "Build command and output directory are required for Next.js and Nuxt",
            path: ["buildCommand"]
        }
    );

type FormValues = z.infer<typeof schema>;

type Framework = "html" | "nextjs" | "vite" | "nuxt";

const FRAMEWORKS: { value: Framework; label: string; status: "supported" | "coming-soon" }[] = [
    { value: "nextjs", label: "Next.js", status: "supported" },
    { value: "vite", label: "Vite", status: "supported" },
    { value: "nuxt", label: "Nuxt", status: "supported" },
    { value: "html", label: "HTML", status: "supported" }
];

function formatAddress(address: string) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function NewProjectForm() {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { network } = useNetwork();
    const { address, isConnected } = useAppKitAccount();
    const publicClient = usePublicClient();
    const { repositories, installations, loading: reposLoading, error: reposError, refresh } = useRepositories();
    const [selectedRepo, setSelectedRepo] = useState<RepositorySummary | null>(null);
    const { branches, loading: branchesLoading } = useBranches(selectedRepo?.installationId ?? null, selectedRepo?.fullName ?? null);
    const walletAddress = isConnected && address ? address : null;
    const { domains: ensDomains, loading: ensLoading, error: ensError, refresh: refreshEns } = useEnsDomains(walletAddress);

    // Fetch ENS name for the connected wallet address
    const { data: walletEnsName } = useQuery({
        queryKey: ["walletEnsName", walletAddress],
        queryFn: async () => {
            if (!walletAddress || !publicClient) return null;
            try {
                return await publicClient.getEnsName({ address: walletAddress as `0x${string}` });
            } catch {
                return null;
            }
        },
        enabled: isConnected && !!walletAddress && !!publicClient,
        staleTime: 5 * 60 * 1000 // Cache for 5 minutes
    });

    // Debug logging
    useEffect(() => {
        console.log("[NewProjectForm] Wallet state:", {
            isConnected,
            address,
            walletAddress,
            ensDomainsCount: ensDomains.length,
            ensLoading,
            ensError
        });
    }, [isConnected, address, walletAddress, ensDomains.length, ensLoading, ensError]);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            name: "",
            repoName: "",
            repoUrl: "",
            repoBranch: "main",
            framework: "nextjs",
            enableEns: true,
            ensName: "",
            ensOwnerAddress: "",
            buildCommand: undefined,
            outputDir: undefined,
            frontendDir: undefined
        }
    });

    // Prepare repository options for combobox
    const repoOptions = useMemo(() => {
        return repositories
            .map((repo) => ({
                value: repo.id.toString(),
                label: repo.fullName,
                description: repo.description || undefined
            }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [repositories]);

    const ensOptions = useMemo(() => {
        return ensDomains.map((domain) => ({
            value: domain.name,
            label: domain.name,
            description: domain.expiry ? `Expires ${domain.expiry.toLocaleDateString()}` : undefined
        }));
    }, [ensDomains]);

    // Handle repository selection from combobox
    const handleRepoSelect = (repoId: string) => {
        const repo = repositories.find((r) => r.id.toString() === repoId);
        if (repo) {
            setSelectedRepo(repo);
        }
    };

    const handleEnsSelect = (value: string) => {
        form.setValue("ensName", value, { shouldValidate: true, shouldDirty: true });
    };

    // Set default branch when repo is selected
    useEffect(() => {
        if (selectedRepo) {
            form.setValue("repoName", selectedRepo.fullName);
            form.setValue("repoUrl", selectedRepo.url);
            if (!form.getValues("name")) {
                form.setValue("name", selectedRepo.name);
            }

            // Auto-select default branch when repo is selected
            if (selectedRepo.defaultBranch) {
                form.setValue("repoBranch", selectedRepo.defaultBranch);
            }
        }
    }, [selectedRepo, form]);

    // Update branch when branches are loaded and default branch is available
    useEffect(() => {
        if (selectedRepo && branches.length > 0 && selectedRepo.defaultBranch) {
            const defaultBranchExists = branches.some((b) => b.name === selectedRepo.defaultBranch);
            if (defaultBranchExists) {
                form.setValue("repoBranch", selectedRepo.defaultBranch);
            }
        }
    }, [branches, selectedRepo, form]);

    const selectedFramework = form.watch("framework");
    const enableEns = form.watch("enableEns");
    const selectedEnsName = form.watch("ensName");
    const isWalletReady = Boolean(walletAddress);
    const walletDisplayName = walletEnsName || (walletAddress ? formatAddress(walletAddress) : null);
    // Can submit if repo selected AND (ENS disabled OR (ENS enabled AND domain selected AND wallet ready))
    const canSubmit = Boolean(selectedRepo && (!enableEns || (selectedEnsName && isWalletReady)));

    useEffect(() => {
        if (walletAddress) {
            form.setValue("ensOwnerAddress", walletAddress, { shouldValidate: true });
        } else {
            form.setValue("ensOwnerAddress", "", { shouldValidate: true });
        }
    }, [walletAddress, form]);

    useEffect(() => {
        if (ensOptions.length === 0) {
            form.setValue("ensName", "");
            return;
        }

        const currentValue = form.getValues("ensName");
        const exists = ensOptions.some((option) => option.value === currentValue);
        if (!currentValue || !exists) {
            form.setValue("ensName", ensOptions[0].value, { shouldValidate: true });
        }
    }, [ensOptions, form]);

    // Set default build config based on framework selection
    useEffect(() => {
        if (selectedFramework === "nextjs") {
            form.setValue("buildCommand", "npm run build");
            form.setValue("outputDir", "out");
        } else if (selectedFramework === "vite") {
            form.setValue("buildCommand", "npm run build");
            form.setValue("outputDir", "dist");
        } else if (selectedFramework === "nuxt") {
            form.setValue("buildCommand", "npm run generate");
            form.setValue("outputDir", ".output/public");
        } else if (selectedFramework === "html") {
            // Clear build config for HTML
            form.setValue("buildCommand", undefined);
            form.setValue("outputDir", undefined);
        }
    }, [selectedFramework, form]);

    // Conflict handling
    const [isConflictDialogOpen, setIsConflictDialogOpen] = useState(false);
    const [conflictProjectName, setConflictProjectName] = useState("");
    const [pendingFormValues, setPendingFormValues] = useState<FormValues | null>(null);

    const onSubmit = async (values: FormValues, force = false) => {
        if (!selectedRepo) {
            showToast("Please select a repository", "error")
            return
        }
        
        try {
            const project = await projectsService.create({
                name: values.name,
                repoFullName: values.repoName,
                repoUrl: values.repoUrl,
                repoBranch: values.repoBranch,
                installationId: selectedRepo.installationId,
                network,
                ensName: values.enableEns ? values.ensName : undefined,
                ensOwnerAddress: values.enableEns ? values.ensOwnerAddress : undefined,
                buildCommand: values.buildCommand || undefined,
                outputDir: values.outputDir || undefined,
                frontendDir: values.frontendDir || undefined,
                force
            });

            // Start deployment immediately
            const { deploymentId } = await deploymentsService.create(project.id);

            showToast("Project created and deployment started!", "success");
            navigate(`/deployments/${deploymentId}`);
        } catch (error: any) {
            console.error("[NewProjectForm]", error);

            // Check for conflict error
            if (error?.response?.data?.error === 'ENS_ALREADY_LINKED') {
                setConflictProjectName(error.response.data.existingProjectName);
                setPendingFormValues(values);
                setIsConflictDialogOpen(true);
                return;
            }

            showToast("Failed to create project", "error");
        }
    };

    return (
        <form onSubmit={form.handleSubmit((values) => onSubmit(values, false))} className="space-y-6">
            {/* Framework Selection */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Framework</CardTitle>
                    <p className="text-sm text-muted-foreground">Select the framework for your project</p>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-3">
                        {FRAMEWORKS.map((framework) => {
                            const isSelected = selectedFramework === framework.value;
                            const isComingSoon = framework.status === "coming-soon";
                            return (
                                <button
                                    key={framework.value}
                                    type="button"
                                    onClick={() => {
                                        if (!isComingSoon) {
                                            form.setValue("framework", framework.value);
                                        }
                                    }}
                                    disabled={isComingSoon}
                                    className={`relative rounded-lg border p-4 text-left transition-smooth ${isSelected
                                        ? "border-primary bg-primary/10"
                                        : isComingSoon
                                            ? "border-border bg-muted/20 opacity-60 cursor-not-allowed"
                                            : "border-border hover:border-primary/50 hover:bg-accent/50"
                                        }`}>
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold">{framework.label}</span>
                                        {isComingSoon ? (
                                            <Badge variant="outline" className="text-xs">
                                                Soon
                                            </Badge>
                                        ) : isSelected ? (
                                            <Badge className="text-xs">Selected</Badge>
                                        ) : null}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                    {form.formState.errors.framework && (
                        <p className="text-sm text-destructive font-medium">{form.formState.errors.framework.message}</p>
                    )}
                </CardContent>
            </Card>

            {/* Configuration Requirements */}
            {selectedFramework && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Info className="h-5 w-5 text-primary" />
                            Configuration Requirements
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">Your project needs specific configuration for static deployment</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {selectedFramework === "nextjs" && (
                            <Alert variant="info">
                                <Info className="h-4 w-4" />
                                <AlertTitle>Next.js Static Export Configuration</AlertTitle>
                                <AlertDescription className="space-y-3 mt-2">
                                    <p>
                                        Your Next.js project must be configured for static export. Add the following to your{" "}
                                        <code className="px-1.5 py-0.5 rounded bg-muted text-sm font-mono">next.config.js</code>:
                                    </p>
                                    <div className="rounded-lg bg-muted p-4 font-mono text-xs overflow-x-auto">
                                        <pre className="whitespace-pre-wrap">
                                            {`module.exports = {
  output: 'export',
  trailingSlash: true
}`}
                                        </pre>
                                    </div>
                                    <div className="space-y-2 text-xs text-muted-foreground">
                                        <p>
                                            <strong>Important:</strong> Static export does not support dynamic routes. Avoid using:
                                        </p>
                                        <ul className="list-disc list-inside space-y-1 ml-2">
                                            <li>
                                                <code className="px-1 py-0.5 rounded bg-muted font-mono">pages/[id].tsx</code> or{" "}
                                                <code className="px-1 py-0.5 rounded bg-muted font-mono">app/[slug]/page.tsx</code>
                                            </li>
                                            <li>Server-side features like <code className="px-1 py-0.5 rounded bg-muted font-mono">getServerSideProps</code></li>
                                            <li>API routes in <code className="px-1 py-0.5 rounded bg-muted font-mono">pages/api/</code></li>
                                        </ul>
                                    </div>
                                    <a
                                        href="https://nextjs.org/docs/app/api-reference/next-config-js/output"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                                        <ExternalLink className="h-3 w-3" />
                                        Next.js Static Export Documentation
                                    </a>
                                </AlertDescription>
                            </Alert>
                        )}

                        {selectedFramework === "vite" && (
                            <Alert variant="warning">
                                <Info className="h-4 w-4" />
                                <AlertTitle>Vite Static Deployment - Router Configuration</AlertTitle>
                                <AlertDescription className="space-y-3 mt-2">
                                    <p>
                                        For static deployments, you must use{" "}
                                        <code className="px-1.5 py-0.5 rounded bg-muted text-sm font-mono">HashRouter</code> instead of{" "}
                                        <code className="px-1.5 py-0.5 rounded bg-muted text-sm font-mono">BrowserRouter</code>.
                                    </p>
                                    <div className="space-y-2">
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-1">Before (won't work with static hosting):</p>
                                            <div className="rounded-lg bg-muted p-3 font-mono text-xs overflow-x-auto">
                                                <pre className="whitespace-pre-wrap">{`import { BrowserRouter } from 'react-router-dom'`}</pre>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-1">After (works with static hosting):</p>
                                            <div className="rounded-lg bg-muted p-3 font-mono text-xs overflow-x-auto">
                                                <pre className="whitespace-pre-wrap">
                                                    {`import { HashRouter } from 'react-router-dom'

// Wrap your app:
<HashRouter>
  <App />
</HashRouter>`}
                                                </pre>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        <strong>Why:</strong> Static file hosting doesn't support server-side routing. HashRouter uses{" "}
                                        <code className="px-1 py-0.5 rounded bg-muted text-xs font-mono">#</code> in URLs which works with static
                                        hosting.
                                    </p>
                                    <a
                                        href="https://reactrouter.com/en/main/router-components/hash-router"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                                        <ExternalLink className="h-3 w-3" />
                                        React Router HashRouter Documentation
                                    </a>
                                </AlertDescription>
                            </Alert>
                        )}

                        {selectedFramework === "nuxt" && (
                            <Alert variant="info">
                                <Info className="h-4 w-4" />
                                <AlertTitle>Nuxt 3 Static Generation Configuration</AlertTitle>
                                <AlertDescription className="space-y-3 mt-2">
                                    <p>
                                        Configure Nuxt for static site generation. Add the following to your{" "}
                                        <code className="px-1.5 py-0.5 rounded bg-muted text-sm font-mono">nuxt.config.ts</code>:
                                    </p>
                                    <div className="rounded-lg bg-muted p-4 font-mono text-xs overflow-x-auto">
                                        <pre className="whitespace-pre-wrap">
                                            {`export default defineNuxtConfig({
  ssr: false,  // Disable server-side rendering
  nitro: {
    preset: 'static'
  }
})`}
                                        </pre>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        <strong>Note:</strong> The build command is already set to{" "}
                                        <code className="px-1 py-0.5 rounded bg-muted text-xs font-mono">npm run generate</code> which is correct for
                                        static generation.
                                    </p>
                                    <a
                                        href="https://nuxt.com/docs/getting-started/deployment#static-hosting"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                                        <ExternalLink className="h-3 w-3" />
                                        Nuxt Static Generation Documentation
                                    </a>
                                </AlertDescription>
                            </Alert>
                        )}

                        {selectedFramework === "html" && (
                            <Alert variant="info">
                                <Info className="h-4 w-4" />
                                <AlertTitle>HTML Static Site Requirements</AlertTitle>
                                <AlertDescription className="space-y-3 mt-2">
                                    <p>For HTML static sites to work perfectly with static hosting, ensure the following:</p>
                                    <ul className="list-disc list-inside space-y-2 text-sm">
                                        <li>
                                            <strong>Use relative paths</strong> for all assets (CSS, JavaScript, images)
                                        </li>
                                        <li>
                                            <strong>No server-side dependencies</strong> - all functionality must be client-side
                                        </li>
                                        <li>
                                            <strong>index.html at root</strong> - your main HTML file should be at the repository root or in the
                                            specified frontend directory
                                        </li>
                                        <li>
                                            <strong>No absolute paths</strong> - avoid paths starting with{" "}
                                            <code className="px-1 py-0.5 rounded bg-muted text-xs font-mono">/</code> that won't work with static
                                            hosting
                                        </li>
                                    </ul>
                                    <div className="space-y-2">
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-1">❌ Avoid (absolute paths):</p>
                                            <div className="rounded-lg bg-muted p-3 font-mono text-xs overflow-x-auto">
                                                <pre className="whitespace-pre-wrap">
                                                    {`<link rel="stylesheet" href="/css/style.css">
<script src="/js/app.js"></script>
<img src="/images/logo.png">`}
                                                </pre>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-1">✅ Use (relative paths):</p>
                                            <div className="rounded-lg bg-muted p-3 font-mono text-xs overflow-x-auto">
                                                <pre className="whitespace-pre-wrap">
                                                    {`<link rel="stylesheet" href="css/style.css">
<script src="js/app.js"></script>
<img src="images/logo.png">`}
                                                </pre>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        <strong>Note:</strong> All files in your repository (except{" "}
                                        <code className="px-1 py-0.5 rounded bg-muted text-xs font-mono">.git</code>,{" "}
                                        <code className="px-1 py-0.5 rounded bg-muted text-xs font-mono">.github</code>, and{" "}
                                        <code className="px-1 py-0.5 rounded bg-muted text-xs font-mono">node_modules</code>) will be deployed as-is.
                                    </p>
                                </AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Build Configuration */}
            {(selectedFramework === "nextjs" || selectedFramework === "vite" || selectedFramework === "nuxt") && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Build Configuration</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            {selectedFramework === "nextjs"
                                ? "Customize how Filify builds and exports your Next.js project."
                                : selectedFramework === "nuxt"
                                    ? "Customize how Filify builds and generates your Nuxt 3 project."
                                    : "Customize how Filify builds your Vite project."}
                        </p>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="buildCommand">Build command</Label>
                                <Input id="buildCommand" placeholder="npm run build" {...form.register("buildCommand")} />
                                {form.formState.errors.buildCommand && (
                                    <p className="text-sm text-destructive font-medium">{form.formState.errors.buildCommand.message}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="outputDir">Output directory</Label>
                                <Input
                                    id="outputDir"
                                    placeholder={selectedFramework === "nextjs" ? "out" : selectedFramework === "nuxt" ? ".output/public" : "dist"}
                                    {...form.register("outputDir")}
                                />
                                {form.formState.errors.outputDir && (
                                    <p className="text-sm text-destructive font-medium">{form.formState.errors.outputDir.message}</p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Repository Selection */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">GitHub Repository</CardTitle>
                    <p className="text-sm text-muted-foreground">Connect your repository and configure the project</p>
                </CardHeader>
                <CardContent className="space-y-4">
                    {installations.length === 0 && !reposLoading ? (
                        <div className="flex flex-col items-center justify-center gap-4 py-8 border rounded-lg bg-muted/20">
                            <Github className="h-12 w-12 text-muted-foreground" />
                            <div className="text-center space-y-2">
                                <p className="font-medium">No GitHub repositories connected</p>
                                <p className="text-sm text-muted-foreground">
                                    Connect your GitHub account to select which repositories Filify can access
                                </p>
                            </div>
                            <Button
                                type="button"
                                onClick={async () => {
                                    const { data } = await api.get<{ url: string }>('/github/install?returnPath=/projects/new');
                                    window.location.href = data.url;
                                }}
                            >
                                <Github className="h-5 w-5" />
                                Connect GitHub
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <Label>Repository</Label>
                                <Combobox
                                    options={repoOptions}
                                    value={selectedRepo?.id.toString()}
                                    onValueChange={handleRepoSelect}
                                    placeholder="Search and select a repository..."
                                    disabled={reposLoading}
                                    loading={reposLoading}
                                    emptyMessage={reposError ? "Failed to load repositories" : "No repositories found"}
                                />
                                {reposError && (
                                    <p className="text-sm text-destructive">
                                        {reposError}{" "}
                                        <button type="button" className="underline font-semibold hover:text-destructive/80" onClick={() => refresh()}>
                                            Retry
                                        </button>
                                    </p>
                                )}
                            </div>

                            <div className="rounded-lg border bg-muted/30 p-3">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-sm font-medium text-muted-foreground">Connected accounts</p>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => refresh()}
                                        disabled={reposLoading}
                                    >
                                        {reposLoading ? "Refreshing…" : "Refresh"}
                                    </Button>
                                </div>
                                <div className="space-y-2">
                                    {installations.map((installation) => (
                                        <div key={installation.id} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                {installation.accountAvatarUrl ? (
                                                    <img src={installation.accountAvatarUrl} alt="" className="h-5 w-5 rounded-full" />
                                                ) : (
                                                    <Github className="h-5 w-5 text-muted-foreground" />
                                                )}
                                                <span className="text-sm">{installation.accountLogin}</span>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                                                onClick={() => {
                                                    window.open(
                                                        `https://github.com/settings/installations/${installation.installationId}`,
                                                        '_blank'
                                                    );
                                                }}
                                            >
                                                <Settings className="h-3 w-3" />
                                                Configure
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Project name</Label>
                                    <Input id="name" placeholder="My cool dapp" {...form.register("name")} />
                                    {form.formState.errors.name && (
                                        <p className="text-sm text-destructive font-medium">{form.formState.errors.name.message}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="branch">Branch</Label>
                                    <select
                                        id="branch"
                                        className="flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        disabled={!selectedRepo || branchesLoading}
                                        {...form.register("repoBranch")}>
                                        <option value="">{branchesLoading ? "Loading..." : "Select a branch"}</option>
                                        {branches.map((branch) => (
                                            <option key={branch.name} value={branch.name}>
                                                {branch.name}
                                            </option>
                                        ))}
                                    </select>
                                    {form.formState.errors.repoBranch && (
                                        <p className="text-sm text-destructive font-medium">{form.formState.errors.repoBranch.message}</p>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="frontendDir">Frontend directory (optional)</Label>
                                <Input id="frontendDir" placeholder="e.g., frontend, web, app" {...form.register("frontendDir")} />
                                <p className="text-xs text-muted-foreground">
                                    If your frontend code is in a subdirectory, specify the path relative to the repository root. Leave empty if the frontend
                                    is at the root.
                                </p>
                                {form.formState.errors.frontendDir && (
                                    <p className="text-sm text-destructive font-medium">{form.formState.errors.frontendDir.message}</p>
                                )}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Deployment Access</CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Choose how users will access your deployed site
                    </p>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Option Cards */}
                    <div className="grid gap-3 sm:grid-cols-2">
                        {/* With ENS Option */}
                        <button
                            type="button"
                            onClick={() => form.setValue("enableEns", true)}
                            className={`relative flex flex-col items-start gap-2 rounded-lg border-2 p-4 text-left transition-all hover:bg-secondary/50 ${enableEns ? "border-primary bg-primary/5" : "border-muted"
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <div className={`h-4 w-4 rounded-full border-2 ${enableEns ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                                    {enableEns && <div className="h-full w-full flex items-center justify-center"><div className="h-1.5 w-1.5 rounded-full bg-background" /></div>}
                                </div>
                                <span className="font-semibold">Link ENS Domain</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Access via your .eth domain (e.g., yoursite.eth.limo)
                            </p>
                        </button>

                        {/* IPFS Only Option */}
                        <button
                            type="button"
                            onClick={() => form.setValue("enableEns", false)}
                            className={`relative flex flex-col items-start gap-2 rounded-lg border-2 p-4 text-left transition-all hover:bg-secondary/50 ${!enableEns ? "border-primary bg-primary/5" : "border-muted"
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <div className={`h-4 w-4 rounded-full border-2 ${!enableEns ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                                    {!enableEns && <div className="h-full w-full flex items-center justify-center"><div className="h-1.5 w-1.5 rounded-full bg-background" /></div>}
                                </div>
                                <span className="font-semibold">IPFS Only</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Access via IPFS gateway URL. You can add ENS later.
                            </p>
                        </button>
                    </div>

                    {/* ENS Domain Selection (shown when ENS enabled) */}
                    {enableEns && (
                        <div className="space-y-3 pt-2 border-t">
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-muted-foreground">
                                    Select a domain owned by your connected wallet{walletDisplayName ? ` (${walletDisplayName})` : ""}
                                </p>
                                <Button type="button" variant="outline" size="sm" onClick={() => void refreshEns()} disabled={!isWalletReady || ensLoading}>
                                    {ensLoading ? "Refreshing…" : "Refresh"}
                                </Button>
                            </div>
                            <Combobox
                                options={ensOptions}
                                value={selectedEnsName}
                                onValueChange={handleEnsSelect}
                                placeholder={isWalletReady ? "Select an ENS domain..." : "Connect wallet to load ENS domains"}
                                disabled={!isWalletReady || ensLoading || ensOptions.length === 0}
                                loading={ensLoading}
                                emptyMessage={isWalletReady ? "No ENS domains found for this wallet" : "Connect wallet to load ENS domains"}
                            />
                            {form.formState.errors.ensName && <p className="text-sm text-destructive font-medium">{form.formState.errors.ensName.message}</p>}
                            {form.formState.errors.ensOwnerAddress && (
                                <p className="text-sm text-destructive font-medium">{form.formState.errors.ensOwnerAddress.message}</p>
                            )}
                            {ensError && <p className="text-sm text-destructive font-medium">{ensError}</p>}
                            {!ensLoading && isWalletReady && ensOptions.length === 0 && (
                                <p className="text-sm text-muted-foreground">
                                    No ENS domains detected for this wallet. Visit{" "}
                                    <a
                                        href="https://app.ens.domains"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="font-medium text-primary underline-offset-2 hover:underline">
                                        app.ens.domains
                                    </a>{" "}
                                    to register or manage your names.
                                </p>
                            )}
                            {!isWalletReady && <p className="text-sm text-muted-foreground">Connect your Ethereum wallet to load available ENS domains.</p>}
                            <input type="hidden" {...form.register("ensOwnerAddress")} />
                        </div>
                    )}
                </CardContent>
            </Card>

            <Button type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting || !canSubmit}>
                {form.formState.isSubmitting ? "Creating & deploying..." : "Create & Deploy"}
            </Button>
            {/* Conflict Alert Dialog */}
            <AlertDialog open={isConflictDialogOpen} onOpenChange={setIsConflictDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Domain Already Linked</AlertDialogTitle>
                        <AlertDialogDescription>
                            The domain <strong>{selectedEnsName}</strong> is currently linked to the project <strong>{conflictProjectName}</strong>.
                            <br /><br />
                            Do you want to unlink it from there and link it to this new project instead?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => {
                            setIsConflictDialogOpen(false);
                            setPendingFormValues(null);
                        }}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                if (pendingFormValues) {
                                    setIsConflictDialogOpen(false);
                                    onSubmit(pendingFormValues, true);
                                }
                            }}
                        >
                            Confirm & Link
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </form >
    );
}
