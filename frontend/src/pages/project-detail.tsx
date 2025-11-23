import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { AxiosError } from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useProject } from "@/hooks/use-project";
import { deploymentsService } from "@/services/deployments.service";
import { projectsService } from "@/services/projects.service";
import { repositoriesService } from "@/services/repositories.service";
import { useToast } from "@/context/toast-context";
import { DeploymentStatusBadge } from "@/components/deployments/deployment-status-badge";
import { useAutoDeployPoller } from "@/hooks/use-auto-deploy-poller";

const RESUMABLE_STATUSES = new Set(["failed", "pending_upload", "uploading", "updating_ens", "awaiting_signature", "awaiting_confirmation"]);
const ACTIVE_STATUSES = new Set([
    "pending_build",
    "cloning",
    "building",
    "pending_upload",
    "uploading",
    "updating_ens",
    "awaiting_signature",
    "awaiting_confirmation"
]);

export function ProjectDetailPage() {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();
    const { project, loading, error, refresh } = useProject(projectId);
    const { showToast } = useToast();
    const [isDeploying, setIsDeploying] = useState(false);
    const [resumeFromPrevious, setResumeFromPrevious] = useState(false);
    const [branchOptions, setBranchOptions] = useState<string[]>([]);
    const [branchLoading, setBranchLoading] = useState(false);
    const [branchSaving, setBranchSaving] = useState(false);
    const [webhookUpdating, setWebhookUpdating] = useState(false);
    const [selectedBranch, setSelectedBranch] = useState("main");
    useAutoDeployPoller(true);

    const latestDeployment = project?.deployments?.[0];
    const latestStatusLabel = latestDeployment ? latestDeployment.status.replace("_", " ") : "n/a";
    const canResume = useMemo(() => Boolean(latestDeployment && RESUMABLE_STATUSES.has(latestDeployment.status)), [latestDeployment]);
    const projectBusy = useMemo(() => Boolean(latestDeployment && ACTIVE_STATUSES.has(latestDeployment.status)), [latestDeployment]);

    useEffect(() => {
        if (!canResume) {
            setResumeFromPrevious(false);
        }
    }, [canResume]);

    const handleWebhookToggle = async () => {
        if (!project) return;
        try {
            setWebhookUpdating(true);
            if (project.webhookEnabled) {
                await projectsService.disableWebhook(project.id);
                showToast("Auto deploy disabled", "info");
            } else {
                await projectsService.enableWebhook(project.id, selectedBranch);
                showToast("Auto deploy enabled", "success");
            }
            await refresh();
        } catch (error) {
            console.error("[ProjectDetail][webhook]", error);
            showToast("Failed to update webhook settings", "error");
        } finally {
            setWebhookUpdating(false);
        }
    };

    const handleBranchChange = async (branch: string) => {
        if (!project) return;
        if (branch === project.autoDeployBranch) {
            setSelectedBranch(branch);
            return;
        }
        setSelectedBranch(branch);
        try {
            setBranchSaving(true);
            await projectsService.update(project.id, { autoDeployBranch: branch });
            showToast("Auto deploy branch updated", "success");
            await refresh();
        } catch (error) {
            console.error("[ProjectDetail][branch]", error);
            showToast("Failed to update branch", "error");
        } finally {
            setBranchSaving(false);
        }
    };

    useEffect(() => {
        if (project?.autoDeployBranch) {
            setSelectedBranch(project.autoDeployBranch);
        } else if (project?.repoBranch) {
            setSelectedBranch(project.repoBranch);
        }
    }, [project?.autoDeployBranch, project?.repoBranch]);

    useEffect(() => {
        if (!project) {
            return;
        }
        setBranchLoading(true);
        repositoriesService
            .getBranches(project.repoName)
            .then((branches) => {
                setBranchOptions(branches.map((branch) => branch.name));
            })
            .catch((error) => {
                console.error("[ProjectDetail][branches]", error);
                showToast("Failed to load branches from GitHub", "error");
            })
            .finally(() => setBranchLoading(false));
    }, [project?.repoName, showToast]);

    const handleDeploy = async () => {
        if (!project) return;
        try {
            setIsDeploying(true);
            const { deploymentId } = await deploymentsService.create(project.id, {
                resumeFromPrevious: canResume && resumeFromPrevious
            });
            showToast("Deployment started", "success");
            setResumeFromPrevious(false);
            navigate(`/deployments/${deploymentId}`);
        } catch (err) {
            console.error("[ProjectDetail][deploy]", err);
            let message = "Failed to start deployment";
            if (err instanceof AxiosError) {
                message = (err.response?.data as { message?: string })?.message ?? message;
            }
            showToast(message, "error");
        } finally {
            setIsDeploying(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <Spinner className="h-10 w-10 border-t-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-4">
                <p className="text-destructive">{error}</p>
                <Button variant="outline" onClick={() => navigate("/dashboard")}>
                    Back to dashboard
                </Button>
            </div>
        );
    }

    if (!project) {
        return null;
    }

    const branchValues = branchOptions.includes(selectedBranch)
        ? branchOptions
        : [selectedBranch, ...branchOptions.filter((branch) => branch !== selectedBranch)];

    return (
        <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-2">
                    <p className="text-sm font-bold uppercase tracking-wide text-cyan">Project</p>
                    <h2 className="text-4xl font-bold text-foreground">{project.name}</h2>
                    <p className="text-base font-medium text-muted-foreground">{project.repoName}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <Button variant="ghost" onClick={() => navigate("/dashboard")}>
                        Back
                    </Button>
                    <Button onClick={handleDeploy} disabled={isDeploying || projectBusy} size="lg" className="shadow-neo">
                        {isDeploying ? "Deploying..." : projectBusy ? "Deployment running" : "Deploy now"}
                    </Button>
                </div>
            </div>

            {projectBusy ? (
                <div className="flex items-start gap-3 rounded-xl bg-primary/10 p-5 text-primary border border-primary/20 shadow-neo-sm">
                    <p className="text-sm font-semibold">
                        A deployment is currently running. Cancel it or wait until it completes before starting a new one.
                    </p>
                </div>
            ) : null}

            <Card>
                <CardHeader>
                    <CardTitle>Auto Deploy</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">
                                Enable GitHub webhooks to trigger deployments whenever you push to the selected branch.
                            </p>
                            <div className="flex flex-wrap items-center gap-3">
                                <Badge variant={project.webhookEnabled ? "success" : "outline"}>
                                    {project.webhookEnabled ? "Webhook Active" : "Webhook Inactive"}
                                </Badge>
                                <span className="text-xs font-semibold text-muted-foreground">
                                    Branch: <span className="text-foreground">{project.autoDeployBranch ?? project.repoBranch ?? "main"}</span>
                                </span>
                            </div>
                        </div>
                        <Button onClick={handleWebhookToggle} disabled={webhookUpdating} variant={project.webhookEnabled ? "outline" : "default"}>
                            {webhookUpdating ? "Saving…" : project.webhookEnabled ? "Disable Auto Deploy" : "Enable Auto Deploy"}
                        </Button>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Auto Deploy Branch</label>
                        <select
                            value={selectedBranch}
                            onChange={(event) => handleBranchChange(event.target.value)}
                            disabled={branchLoading || branchSaving || webhookUpdating}
                            className="w-full rounded-lg border border-border bg-card/50 p-2 text-sm font-semibold shadow-neo-sm focus:outline-none focus:ring-2 focus:ring-primary">
                            {branchValues.map((branch) => (
                                <option key={branch} value={branch}>
                                    {branch}
                                </option>
                            ))}
                        </select>
                        {branchLoading ? <p className="text-xs text-muted-foreground">Loading branches…</p> : null}
                    </div>
                    <p className="text-xs font-medium text-muted-foreground">
                        Your project will automatically deploy when you push to the selected branch.
                    </p>
                </CardContent>
            </Card>

            {canResume ? (
                <label className="flex items-start gap-3 rounded-xl bg-muted/30 p-5 text-sm font-medium text-muted-foreground shadow-neo-inset cursor-pointer transition-neo hover:bg-muted/40">
                    <input
                        type="checkbox"
                        className="mt-1 h-5 w-5 rounded-lg border-2 border-border accent-primary shadow-neo-sm cursor-pointer"
                        checked={resumeFromPrevious}
                        onChange={(event) => setResumeFromPrevious(event.target.checked)}
                        disabled={isDeploying || projectBusy}
                    />
                    <div className="flex-1 space-y-1">
                        <span className="font-semibold text-foreground">Resume from last build (status: {latestStatusLabel})</span>
                        <span className="block text-xs">Uncheck to run a full deployment and clone the repository again.</span>
                    </div>
                </label>
            ) : null}

            <Card>
                <CardHeader>
                    <CardTitle>Configuration</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Repository</p>
                        <a
                            href={project.repoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-bold text-foreground underline-offset-4 hover:underline">
                            {project.repoName}
                        </a>
                        <p className="text-xs font-medium text-muted-foreground">Branch: {project.repoBranch}</p>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">ENS</p>
                        <p className="font-bold">{project.ensName}</p>
                    </div>
                    {project.buildCommand ? (
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Build command</p>
                            <p className="font-mono text-xs font-bold">{project.buildCommand}</p>
                        </div>
                    ) : null}
                    {project.outputDir ? (
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Output directory</p>
                            <p className="font-mono text-xs font-bold">{project.outputDir}</p>
                        </div>
                    ) : null}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Deployment history</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {project.deployments && project.deployments.length > 0 ? (
                        project.deployments.map((deployment) => (
                            <div
                                key={deployment.id}
                                className="group rounded-xl bg-card/50 px-6 py-5 shadow-neo-sm transition-neo hover:shadow-neo hover:-translate-y-1">
                                <div className="flex flex-wrap items-center justify-between gap-4">
                                    <div className="space-y-2">
                                        <DeploymentStatusBadge status={deployment.status} />
                                        {deployment.triggeredBy ? (
                                            <Badge variant="outline" className="uppercase text-[10px] tracking-wide">
                                                {deployment.triggeredBy === "webhook" ? "Auto" : "Manual"}
                                            </Badge>
                                        ) : null}
                                        <p className="text-sm font-medium text-muted-foreground">
                                            {formatDistanceToNow(new Date(deployment.createdAt), { addSuffix: true })}
                                        </p>
                                        {deployment.commitSha ? (
                                            <a
                                                href={`${project.repoUrl}/commit/${deployment.commitSha}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="block text-xs font-semibold text-cyan underline-offset-4 hover:underline">
                                                {deployment.commitSha.slice(0, 7)} –{" "}
                                                {deployment.commitMessage
                                                    ? `${deployment.commitMessage.slice(0, 40)}${deployment.commitMessage.length > 40 ? "…" : ""}`
                                                    : "View commit"}
                                            </a>
                                        ) : null}
                                        {deployment.ipfsCid ? (
                                            <a
                                                href={`https://${deployment.ipfsCid}.ipfs.dweb.link`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="block text-sm text-cyan underline-offset-4 hover:underline font-semibold">
                                                IPFS: {deployment.ipfsCid.slice(0, 12)}...
                                            </a>
                                        ) : null}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={() => navigate(`/deployments/${deployment.id}`)}>
                                            View status
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-muted-foreground font-medium">No deployments yet.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
