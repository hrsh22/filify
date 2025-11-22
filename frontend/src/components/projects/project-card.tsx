import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, Rocket, GitBranch, FolderOutput, Terminal, AlertCircle, ArrowRight } from "lucide-react";
import { AxiosError } from "axios";
import type { Project } from "@/types";
import { deploymentsService } from "@/services/deployments.service";
import { projectsService } from "@/services/projects.service";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/context/toast-context";

interface ProjectCardProps {
    project: Project;
    onChange?: () => void;
}

const statusVariantMap: Record<string, "default" | "success" | "warning" | "destructive"> = {
    success: "success",
    failed: "destructive",
    building: "warning",
    uploading: "warning",
    updating_ens: "warning",
    awaiting_signature: "warning",
    awaiting_confirmation: "warning",
    cloning: "warning",
    pending_build: "warning",
    pending_upload: "warning",
    cancelled: "default"
};

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

export function ProjectCard({ project, onChange }: ProjectCardProps) {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [isDeploying, setIsDeploying] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [resumeFromPrevious, setResumeFromPrevious] = useState(false);
    const latestDeployment = project.deployments?.[0];
    const lastStatusLabel = latestDeployment ? latestDeployment.status.replace("_", " ") : "unknown";
    const canResume = Boolean(latestDeployment && RESUMABLE_STATUSES.has(latestDeployment.status));
    const projectBusy = Boolean(latestDeployment && ACTIVE_STATUSES.has(latestDeployment.status));

    useEffect(() => {
        if (!canResume) {
            setResumeFromPrevious(false);
        }
    }, [canResume]);

    const handleDeploy = async () => {
        try {
            setIsDeploying(true);
            const { deploymentId } = await deploymentsService.create(project.id, {
                resumeFromPrevious: canResume && resumeFromPrevious
            });
            showToast("Deployment started", "success");
            setResumeFromPrevious(false);
            navigate(`/deployments/${deploymentId}`);
        } catch (error) {
            console.error("[ProjectCard][deploy]", error);
            let message = "Failed to start deployment";
            if (error instanceof AxiosError) {
                message = (error.response?.data as { message?: string })?.message ?? message;
            }
            showToast(message, "error");
        } finally {
            setIsDeploying(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm("Delete this project? This cannot be undone.")) {
            return;
        }
        try {
            setIsDeleting(true);
            await projectsService.remove(project.id);
            showToast("Project deleted", "success");
            onChange?.();
        } catch (error) {
            console.error("[ProjectCard][delete]", error);
            showToast("Failed to delete project", "error");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="group space-y-6 rounded-xl bg-card border border-border p-7 shadow-neo transition-neo hover:shadow-neo-lg hover:border-primary">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary border border-primary shadow-neo-sm">
                            <Rocket className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Repository</p>
                            <a
                                href={project.repoUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 text-xl font-bold text-foreground hover:text-primary transition-neo group/link">
                                {project.repoName}
                                <ExternalLink className="h-4 w-4 transition-neo group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
                            </a>
                        </div>
                    </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate(`/projects/${project.id}`)}>
                    View details
                    <ArrowRight className="h-4 w-4" />
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 rounded-xl bg-card/50 p-4 shadow-neo-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <GitBranch className="h-4 w-4" />
                        <p className="text-xs font-semibold uppercase tracking-wide">ENS Domain</p>
                    </div>
                    <p className="text-sm font-bold text-cyan">{project.ensName}</p>
                </div>
                <div className="space-y-2 rounded-xl bg-card/50 p-4 shadow-neo-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Latest Deployment</p>
                    {latestDeployment ? (
                        <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={statusVariantMap[latestDeployment.status] ?? "outline"} className="capitalize">
                                    {latestDeployment.status.replace("_", " ")}
                                </Badge>
                                {latestDeployment.triggeredBy ? (
                                    <Badge variant="outline" className="uppercase tracking-wide text-[10px]">
                                        {latestDeployment.triggeredBy === "webhook" ? "Auto" : "Manual"}
                                    </Badge>
                                ) : null}
                            </div>
                            {latestDeployment.commitSha ? (
                                <a
                                    href={`${project.repoUrl}/commit/${latestDeployment.commitSha}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block text-xs font-semibold text-cyan underline-offset-4 hover:underline">
                                    {latestDeployment.commitSha.slice(0, 7)} –{" "}
                                    {latestDeployment.commitMessage
                                        ? `${latestDeployment.commitMessage.slice(0, 40)}${latestDeployment.commitMessage.length > 40 ? "…" : ""}`
                                        : "View commit"}
                                </a>
                            ) : null}
                        </div>
                    ) : (
                        <p className="text-sm font-bold text-muted-foreground">Never deployed</p>
                    )}
                </div>
                {project.buildCommand ? (
                    <div className="space-y-2 rounded-xl bg-card/50 p-4 shadow-neo-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Terminal className="h-4 w-4" />
                            <p className="text-xs font-semibold uppercase tracking-wide">Build Command</p>
                        </div>
                        <p className="font-mono text-xs font-bold text-foreground">{project.buildCommand}</p>
                    </div>
                ) : null}
                {project.outputDir ? (
                    <div className="space-y-2 rounded-xl bg-card/50 p-4 shadow-neo-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <FolderOutput className="h-4 w-4" />
                            <p className="text-xs font-semibold uppercase tracking-wide">Output Directory</p>
                        </div>
                        <p className="font-mono text-xs font-bold text-foreground">{project.outputDir}</p>
                    </div>
                ) : null}
            </div>

            {canResume ? (
                <label className="flex items-start gap-3 rounded-xl bg-muted/30 p-4 text-sm font-medium text-muted-foreground shadow-neo-inset cursor-pointer transition-neo hover:bg-muted/40">
                    <input
                        type="checkbox"
                        className="mt-1 h-5 w-5 rounded-lg border-2 border-border accent-primary shadow-neo-sm cursor-pointer"
                        checked={resumeFromPrevious}
                        onChange={(event) => setResumeFromPrevious(event.target.checked)}
                        disabled={isDeploying}
                    />
                    <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 font-semibold text-foreground">
                            <AlertCircle className="h-4 w-4" />
                            Resume from last build (status: {lastStatusLabel})
                        </div>
                        <p className="text-xs">Uncheck to start a fresh deployment (will re-clone the repository).</p>
                    </div>
                </label>
            ) : null}

            <div className="flex flex-wrap gap-3">
                <Button onClick={handleDeploy} disabled={isDeploying || projectBusy} className="flex-1 min-w-[140px]">
                    <Rocket className="h-4 w-4" />
                    {isDeploying ? "Deploying..." : "Deploy"}
                </Button>
                <Button variant="outline" onClick={handleDelete} disabled={isDeleting} className="min-w-[120px]">
                    {isDeleting ? "Deleting..." : "Delete"}
                </Button>
            </div>
            {projectBusy ? (
                <div className="flex items-start gap-2 rounded-xl bg-primary/10 p-4 text-sm text-primary border border-primary/20">
                    <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                    <p>A deployment is already running. Cancel it or wait for it to finish before starting another.</p>
                </div>
            ) : null}
        </div>
    );
}
