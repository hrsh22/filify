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
import { useToast } from "@/context/toast-context";
import { useNavigate } from "react-router-dom";
import { projectsService } from "@/services/projects.service";
import { useRepositories, useBranches } from "@/hooks/use-repositories";
import { useEnsDomains } from "@/hooks/use-ens-domains";
import { DEFAULT_ETHEREUM_RPC } from "@/utils/constants";

const schema = z
    .object({
        name: z.string().min(1, "Project name is required"),
        repoName: z.string().min(1, "Repository is required"),
        repoUrl: z.string().url(),
        repoBranch: z.string().min(1, "Branch is required"),
        framework: z.enum(["html", "nextjs", "vite", "nuxt"], { required_error: "Framework is required" }),
        ensName: z.string().min(1, "ENS domain is required"),
        ensOwnerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Wallet address is required"),
        buildCommand: z.string().optional(),
        outputDir: z.string().optional(),
        frontendDir: z.string().optional()
    })
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

const ETH_MAINNET_RPC = DEFAULT_ETHEREUM_RPC;

type Framework = "html" | "nextjs" | "vite" | "nuxt";

const FRAMEWORKS: { value: Framework; label: string; status: "supported" | "coming-soon" }[] = [
    { value: "html", label: "HTML", status: "supported" },
    { value: "nextjs", label: "Next.js", status: "supported" },
    { value: "vite", label: "Vite", status: "supported" },
    { value: "nuxt", label: "Nuxt", status: "supported" }
];

function formatAddress(address: string) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function NewProjectForm() {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { address, isConnected } = useAppKitAccount();
    const publicClient = usePublicClient();
    const { repositories, loading: reposLoading, error: reposError, refresh } = useRepositories();
    const [selectedRepo, setSelectedRepo] = useState<RepositorySummary | null>(null);
    const { branches, loading: branchesLoading } = useBranches(selectedRepo?.fullName ?? null);
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
            framework: "html",
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
    const selectedEnsName = form.watch("ensName");
    const isWalletReady = Boolean(walletAddress);
    const walletDisplayName = walletEnsName || (walletAddress ? formatAddress(walletAddress) : null);
    const canSubmit = Boolean(selectedRepo && selectedEnsName && isWalletReady);

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

    const onSubmit = async (values: FormValues) => {
        try {
            await projectsService.create({
                name: values.name,
                repoName: values.repoName,
                repoUrl: values.repoUrl,
                repoBranch: values.repoBranch,
                ensName: values.ensName,
                ensOwnerAddress: values.ensOwnerAddress,
                ethereumRpcUrl: ETH_MAINNET_RPC, // Always use constant RPC
                buildCommand: values.buildCommand || undefined,
                outputDir: values.outputDir || undefined,
                frontendDir: values.frontendDir || undefined
            });
            showToast("Project created!", "success");
            navigate("/dashboard");
        } catch (error) {
            console.error("[NewProjectForm]", error);
            // Silently fail - no error toast
        }
    };

    return (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                                    className={`relative rounded-lg border p-4 text-left transition-smooth ${
                                        isSelected
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
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-start justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-lg">ENS Domain</CardTitle>
                            <p className="text-sm text-muted-foreground">
                                Select a domain owned by your connected wallet{walletDisplayName ? ` (${walletDisplayName})` : ""}
                            </p>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => void refreshEns()} disabled={!isWalletReady || ensLoading}>
                            {ensLoading ? "Refreshing…" : "Refresh"}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
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
                </CardContent>
            </Card>

            <Button type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting || !canSubmit}>
                {form.formState.isSubmitting ? "Creating project..." : "Create project"}
            </Button>
        </form>
    );
}
