import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { RepositorySummary } from "@/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/context/toast-context";
import { useNavigate } from "react-router-dom";
import { projectsService } from "@/services/projects.service";
import { useRepositories, useBranches } from "@/hooks/use-repositories";

const schema = z.object({
    name: z.string().min(1, "Project name is required"),
    repoName: z.string().min(1, "Repository is required"),
    repoUrl: z.string().url(),
    repoBranch: z.string().min(1, "Branch is required"),
    ensName: z.string().regex(/^[a-z0-9-]+\.eth$/i, "Invalid ENS name"),
    ensPrivateKey: z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Private key must be 64 hex chars"),
    ethereumRpcUrl: z.string().url("Invalid RPC URL"),
    buildCommand: z.string().min(1).default("npm run build"),
    outputDir: z.string().min(1).default("out")
});

type FormValues = z.infer<typeof schema>;

const DEFAULT_RPC = import.meta.env.VITE_DEFAULT_ETHEREUM_RPC ?? `https://eth-mainnet.g.alchemy.com/v2/0INEHyBWJeRtdwKOIIkaOW4Jnh92W6gB`;

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
            ensName: "",
            ensPrivateKey: "",
            ethereumRpcUrl: DEFAULT_RPC,
            buildCommand: "npm run build",
            outputDir: "out"
        }
    });

    useEffect(() => {
        if (selectedRepo) {
            form.setValue("repoName", selectedRepo.fullName);
            form.setValue("repoUrl", selectedRepo.url);
            if (!form.getValues("name")) {
                form.setValue("name", selectedRepo.name);
            }
            if (!form.getValues("repoBranch") && selectedRepo.defaultBranch) {
                form.setValue("repoBranch", selectedRepo.defaultBranch);
            }
        }
    }, [selectedRepo, form]);

    const repoOptions = useMemo(() => [...repositories].sort((a, b) => a.fullName.localeCompare(b.fullName)), [repositories]);

    const onSubmit = async (values: FormValues) => {
        try {
            await projectsService.create({
                name: values.name,
                repoName: values.repoName,
                repoUrl: values.repoUrl,
                repoBranch: values.repoBranch,
                ensName: values.ensName,
                ensPrivateKey: values.ensPrivateKey,
                ethereumRpcUrl: values.ethereumRpcUrl,
                buildCommand: values.buildCommand,
                outputDir: values.outputDir
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
            <section className="space-y-4 rounded-3xl border border-border/70 bg-card p-5">
                <div className="space-y-2">
                    <Label>GitHub repository</Label>
                    <select
                        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                        value={selectedRepo?.id ?? ""}
                        onChange={(event) => {
                            const repo = repoOptions.find((item) => item.id.toString() === event.target.value);
                            setSelectedRepo(repo ?? null);
                        }}
                        disabled={reposLoading}>
                        <option value="">{reposLoading ? "Loading repositories..." : "Select a repository"}</option>
                        {repoOptions.map((repo) => (
                            <option key={repo.id} value={repo.id}>
                                {repo.fullName}
                            </option>
                        ))}
                    </select>
                    {reposError ? (
                        <p className="text-sm text-destructive">
                            {reposError}{" "}
                            <button type="button" className="underline" onClick={() => refresh()}>
                                Retry
                            </button>
                        </p>
                    ) : selectedRepo ? (
                        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground">
                            <p className="font-medium text-foreground">{selectedRepo.fullName}</p>
                            {selectedRepo.description ? <p>{selectedRepo.description}</p> : null}
                            <p>Default branch: {selectedRepo.defaultBranch}</p>
                        </div>
                    ) : null}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="name">Project name</Label>
                        <Input id="name" placeholder="My cool dapp" {...form.register("name")} />
                        {form.formState.errors.name ? <p className="text-sm text-destructive">{form.formState.errors.name.message}</p> : null}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="branch">Branch</Label>
                        <select
                            id="branch"
                            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
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
                            <p className="text-sm text-destructive">{form.formState.errors.repoBranch.message}</p>
                        ) : null}
                    </div>
                </div>
            </section>

            <section className="grid gap-6 rounded-3xl border border-border/70 bg-card p-5 md:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="ensName">ENS domain</Label>
                    <Input id="ensName" placeholder="myapp.eth" {...form.register("ensName")} />
                    {form.formState.errors.ensName ? <p className="text-sm text-destructive">{form.formState.errors.ensName.message}</p> : null}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="ensPrivateKey">ENS private key</Label>
                    <Input id="ensPrivateKey" type="password" placeholder="0x..." {...form.register("ensPrivateKey")} />
                    {form.formState.errors.ensPrivateKey ? (
                        <p className="text-sm text-destructive">{form.formState.errors.ensPrivateKey.message}</p>
                    ) : null}
                </div>
                <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="ethereumRpcUrl">Ethereum RPC URL</Label>
                    <Input id="ethereumRpcUrl" placeholder={DEFAULT_RPC} {...form.register("ethereumRpcUrl")} />
                    {form.formState.errors.ethereumRpcUrl ? (
                        <p className="text-sm text-destructive">{form.formState.errors.ethereumRpcUrl.message}</p>
                    ) : null}
                </div>
            </section>

            <section className="space-y-4 rounded-3xl border border-border/70 bg-card p-5">
                <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-primary">Build configuration</p>
                    <p className="text-sm text-muted-foreground">Customize how FilShip builds and exports your project.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="buildCommand">Build command</Label>
                        <Input id="buildCommand" {...form.register("buildCommand")} />
                        {form.formState.errors.buildCommand ? (
                            <p className="text-sm text-destructive">{form.formState.errors.buildCommand.message}</p>
                        ) : null}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="outputDir">Output directory</Label>
                        <Input id="outputDir" {...form.register("outputDir")} />
                        {form.formState.errors.outputDir ? (
                            <p className="text-sm text-destructive">{form.formState.errors.outputDir.message}</p>
                        ) : null}
                    </div>
                </div>
            </section>

            <Button type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting || !selectedRepo}>
                {form.formState.isSubmitting ? "Creating project..." : "Create project"}
            </Button>
        </form>
    );
}
