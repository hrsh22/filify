import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { RepositorySummary } from "@/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { useToast } from "@/context/toast-context";
import { useNavigate } from "react-router-dom";
import { projectsService } from "@/services/projects.service";
import { useRepositories, useBranches } from "@/hooks/use-repositories";

const schema = z.object({
    name: z.string().min(1, "Project name is required"),
    repoName: z.string().min(1, "Repository is required"),
    repoUrl: z.string().url(),
    repoBranch: z.string().min(1, "Branch is required"),
    framework: z.enum(["html", "nextjs"], { required_error: "Framework is required" }),
    ensName: z.string().regex(/^[a-z0-9-]+\.eth$/i, "Invalid ENS name"),
    ensPrivateKey: z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Private key must be 64 hex chars"),
    buildCommand: z.string().optional(),
    outputDir: z.string().optional()
}).refine((data) => {
    // Build config required only for Next.js
    if (data.framework === "nextjs") {
        return !!(data.buildCommand && data.outputDir);
    }
    return true;
}, {
    message: "Build command and output directory are required for Next.js",
    path: ["buildCommand"]
});

type FormValues = z.infer<typeof schema>;

const ETH_MAINNET_RPC = `https://eth-mainnet.g.alchemy.com/v2/0INEHyBWJeRtdwKOIIkaOW4Jnh92W6gB`;

type Framework = "html" | "nextjs";

const FRAMEWORKS: { value: Framework; label: string; status: "supported" | "coming-soon" }[] = [
    { value: "html", label: "HTML", status: "supported" },
    { value: "nextjs", label: "Next.js", status: "coming-soon" },
];

// Simple framework detection based on repo name and description
function detectFramework(repo: RepositorySummary | null): Framework | null {
    if (!repo) return null;
    
    const name = repo.name.toLowerCase();
    const fullName = repo.fullName.toLowerCase();
    const description = (repo.description || "").toLowerCase();
    const searchText = `${name} ${fullName} ${description}`;
    
    if (searchText.includes("next") || searchText.includes("nextjs") || searchText.includes("next.js")) {
        return "nextjs";
    }
    
    // Default to HTML if no framework detected
    return "html";
}

export function NewProjectForm() {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { repositories, loading: reposLoading, error: reposError, refresh } = useRepositories();
    const [selectedRepo, setSelectedRepo] = useState<RepositorySummary | null>(null);
    const { branches, loading: branchesLoading } = useBranches(selectedRepo?.fullName ?? null);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            name: "",
            repoName: "",
            repoUrl: "",
            repoBranch: "main",
            framework: "html",
            ensName: "",
            ensPrivateKey: "",
            buildCommand: undefined,
            outputDir: undefined
        }
    });

    // Prepare repository options for combobox
    const repoOptions = useMemo(() => {
        return repositories
            .map((repo) => ({
                value: repo.id.toString(),
                label: repo.fullName,
                description: repo.description || undefined,
            }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [repositories]);

    // Handle repository selection from combobox
    const handleRepoSelect = (repoId: string) => {
        const repo = repositories.find((r) => r.id.toString() === repoId);
        if (repo) {
            setSelectedRepo(repo);
        }
    };

    // Auto-detect framework and set default branch when repo is selected
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
            
            // Auto-detect framework and suggest it (user can override)
            const detectedFramework = detectFramework(selectedRepo);
            if (detectedFramework) {
                form.setValue("framework", detectedFramework);
            }
        }
    }, [selectedRepo, form, repositories]);

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
    const detectedFramework = detectFramework(selectedRepo);

    // Set default build config when Next.js is selected
    useEffect(() => {
        if (selectedFramework === "nextjs") {
            if (!form.getValues("buildCommand")) {
                form.setValue("buildCommand", "npm run build");
            }
            if (!form.getValues("outputDir")) {
                form.setValue("outputDir", "out");
            }
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
                ensPrivateKey: values.ensPrivateKey,
                ethereumRpcUrl: ETH_MAINNET_RPC, // Always use constant RPC
                buildCommand: values.buildCommand || undefined,
                outputDir: values.outputDir || undefined
            });
            showToast("Project created!", "success");
            navigate("/dashboard");
        } catch (error) {
            console.error("[NewProjectForm]", error);
            showToast("Failed to create project", "error");
        }
    };

    return (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Framework Selection */}
            <section className="space-y-5 rounded-xl bg-card border border-border p-7 shadow-neo">
                <div className="space-y-2">
                    <Label>Framework</Label>
                    <p className="text-xs text-muted-foreground">Select the framework for your project</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
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
                                className={`relative rounded-lg border p-4 text-left transition-neo ${
                                    isSelected
                                        ? "border-primary bg-primary/10 shadow-neo-sm"
                                        : isComingSoon
                                        ? "border-border bg-muted/20 opacity-60 cursor-not-allowed"
                                        : "border-border bg-card hover:border-primary hover:shadow-neo-sm"
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-foreground">{framework.label}</span>
                                    {isComingSoon ? (
                                        <Badge variant="outline" className="text-xs">Coming Soon</Badge>
                                    ) : isSelected ? (
                                        <Badge variant="accent" className="text-xs">Selected</Badge>
                                    ) : null}
                                </div>
                                {detectedFramework === framework.value && selectedRepo && (
                                    <p className="text-xs text-cyan mt-1">Detected from repository</p>
                                )}
                            </button>
                        );
                    })}
                </div>
                {form.formState.errors.framework && (
                    <p className="text-sm text-destructive font-semibold">{form.formState.errors.framework.message}</p>
                )}
            </section>

            {/* Repository Selection */}
            <section className="space-y-5 rounded-xl bg-card border border-border p-7 shadow-neo">
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <Label>GitHub repository</Label>
                        {selectedRepo && detectedFramework && (
                            <Badge variant="accent" className="text-xs">
                                {detectedFramework === "nextjs" ? "Next.js" : "HTML"} detected
                            </Badge>
                        )}
                    </div>
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

                <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-3">
                        <Label htmlFor="name">Project name</Label>
                        <Input id="name" placeholder="My cool dapp" {...form.register("name")} />
                        {form.formState.errors.name ? <p className="text-sm text-destructive font-semibold">{form.formState.errors.name.message}</p> : null}
                    </div>
                    <div className="space-y-3">
                        <Label htmlFor="branch">Branch</Label>
                        <select
                            id="branch"
                            className="w-full rounded-lg bg-input px-4 py-3 text-sm font-medium shadow-neo-inset transition-neo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:glow-primary"
                            disabled={!selectedRepo || branchesLoading}
                            {...form.register("repoBranch")}>
                            <option value="">{branchesLoading ? "Loading..." : "Select a branch"}</option>
                            {branches.map((branch) => (
                                <option key={branch.name} value={branch.name}>
                                    {branch.name}
                                </option>
                            ))}
                        </select>
                        {form.formState.errors.repoBranch ? (
                            <p className="text-sm text-destructive font-semibold">{form.formState.errors.repoBranch.message}</p>
                        ) : null}
                    </div>
                </div>
            </section>

            <section className="grid gap-6 rounded-xl bg-card border border-border p-7 shadow-neo md:grid-cols-2">
                <div className="space-y-3">
                    <Label htmlFor="ensName">ENS domain</Label>
                    <Input id="ensName" placeholder="myapp.eth" {...form.register("ensName")} />
                    {form.formState.errors.ensName ? <p className="text-sm text-destructive font-semibold">{form.formState.errors.ensName.message}</p> : null}
                </div>
                <div className="space-y-3">
                    <Label htmlFor="ensPrivateKey">ENS private key</Label>
                    <Input id="ensPrivateKey" type="password" placeholder="0x..." {...form.register("ensPrivateKey")} />
                    {form.formState.errors.ensPrivateKey ? (
                        <p className="text-sm text-destructive font-semibold">{form.formState.errors.ensPrivateKey.message}</p>
                    ) : null}
                </div>
            </section>

            {/* Build Configuration - Only for Next.js */}
            {selectedFramework === "nextjs" && (
                <section className="space-y-5 rounded-xl bg-card border border-border p-7 shadow-neo">
                    <div className="space-y-2">
                        <p className="text-sm font-bold uppercase tracking-wide text-primary">Build configuration</p>
                        <p className="text-sm font-medium text-muted-foreground leading-relaxed">Customize how Filify builds and exports your Next.js project.</p>
                    </div>
                    <div className="grid gap-5 md:grid-cols-2">
                        <div className="space-y-3">
                            <Label htmlFor="buildCommand">Build command</Label>
                            <Input 
                                id="buildCommand" 
                                placeholder="npm run build"
                                defaultValue="npm run build"
                                {...form.register("buildCommand")} 
                            />
                            {form.formState.errors.buildCommand ? (
                                <p className="text-sm text-destructive font-semibold">{form.formState.errors.buildCommand.message}</p>
                            ) : null}
                        </div>
                        <div className="space-y-3">
                            <Label htmlFor="outputDir">Output directory</Label>
                            <Input 
                                id="outputDir" 
                                placeholder="out"
                                defaultValue="out"
                                {...form.register("outputDir")} 
                            />
                            {form.formState.errors.outputDir ? (
                                <p className="text-sm text-destructive font-semibold">{form.formState.errors.outputDir.message}</p>
                            ) : null}
                        </div>
                    </div>
                </section>
            )}

            <Button type="submit" size="lg" className="w-full shadow-neo-lg" disabled={form.formState.isSubmitting || !selectedRepo}>
                {form.formState.isSubmitting ? "Creating project..." : "Create project"}
            </Button>
        </form>
    );
}
