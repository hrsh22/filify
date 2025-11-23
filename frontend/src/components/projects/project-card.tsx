import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, Rocket, Globe, GitBranch, FolderOutput, Terminal, AlertCircle, ArrowRight, Trash2 } from "lucide-react";
import { AxiosError } from "axios";
import type { Project } from "@/types";
import { deploymentsService } from "@/services/deployments.service";
import { projectsService } from "@/services/projects.service";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { useToast } from "@/context/toast-context";

interface ProjectCardProps {
    project: Project;
    onChange?: () => void;
}

const statusVariantMap: Record<string, "default" | "success" | "warning" | "destructive" | "info"> = {
    success: "success",
    failed: "destructive",
    building: "info",
    uploading: "info",
    updating_ens: "info",
    awaiting_signature: "warning",
    awaiting_confirmation: "warning",
    cloning: "info",
    pending_build: "warning",
    pending_upload: "warning",
    cancelled: "default"
};

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
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const latestDeployment = project.deployments?.[0];
    const projectBusy = Boolean(latestDeployment && ACTIVE_STATUSES.has(latestDeployment.status));

    const handleDeploy = async () => {
        try {
            setIsDeploying(true);
            const { deploymentId } = await deploymentsService.create(project.id);
            showToast("Deployment started", "success");
            navigate(`/deployments/${deploymentId}`);
        } catch (error) {
            console.error("[ProjectCard][deploy]", error);
            // Silently fail - no error toast
        } finally {
            setIsDeploying(false);
        }
    };

    const handleDeleteClick = () => {
        setShowDeleteDialog(true);
    };

    const handleDeleteConfirm = async () => {
        try {
            setIsDeleting(true);
            setShowDeleteDialog(false);
            await projectsService.remove(project.id);
            showToast("Project deleted", "success");
            onChange?.();
        } catch (error) {
            console.error("[ProjectCard][delete]", error);
            // Silently fail - no error toast
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <>
            <Card className="hover-lift transition-smooth">
                <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1">
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                                <Rocket className="h-6 w-6" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-muted-foreground mb-1">Repository</p>
                                <a
                                    href={project.repoUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-2 text-lg font-semibold text-foreground hover:text-primary transition-smooth group truncate">
                                    <span className="truncate">{project.repoName}</span>
                                    <ExternalLink className="h-4 w-4 shrink-0 transition-smooth group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                                </a>
                            </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/projects/${project.id}`)}>
                            View
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                        {/* ENS Domain */}
                        <div className="space-y-2 rounded-lg bg-secondary/50 p-3 border">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Globe className="h-3.5 w-3.5" />
                                <p className="text-xs font-medium">ENS Domain</p>
                            </div>
                            <p className="text-sm font-semibold text-primary truncate">{project.ensName}</p>
                        </div>

                        {/* Latest Deployment */}
                        <div className="space-y-2 rounded-lg bg-secondary/50 p-3 border">
                            <p className="text-xs font-medium text-muted-foreground">Latest Deployment</p>
                            {latestDeployment ? (
                                <div className="space-y-1.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant={statusVariantMap[latestDeployment.status] ?? "outline"} className="capitalize text-xs">
                                            {latestDeployment.status.replace("_", " ")}
                                        </Badge>
                                        {latestDeployment.triggeredBy && (
                                            <Badge variant="outline" className="text-xs">
                                                {latestDeployment.triggeredBy === "webhook" ? "Auto" : "Manual"}
                                            </Badge>
                                        )}
                                    </div>
                                    {latestDeployment.commitSha && (
                                        <a
                                            href={`${project.repoUrl}/commit/${latestDeployment.commitSha}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="block text-xs text-primary hover:underline underline-offset-2 truncate">
                                            {latestDeployment.commitSha.slice(0, 7)}
                                            {latestDeployment.commitMessage &&
                                                ` – ${latestDeployment.commitMessage.slice(0, 30)}${latestDeployment.commitMessage.length > 30 ? "..." : ""}`}
                                        </a>
                                    )}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">Never deployed</p>
                            )}
                        </div>

                        {/* Build Command */}
                        {project.buildCommand && (
                            <div className="space-y-2 rounded-lg bg-secondary/50 p-3 border">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Terminal className="h-3.5 w-3.5" />
                                    <p className="text-xs font-medium">Build Command</p>
                                </div>
                                <p className="font-mono text-xs text-foreground truncate">{project.buildCommand}</p>
                            </div>
                        )}

                        {/* Output Directory */}
                        {project.outputDir && (
                            <div className="space-y-2 rounded-lg bg-secondary/50 p-3 border">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <FolderOutput className="h-3.5 w-3.5" />
                                    <p className="text-xs font-medium">Output Directory</p>
                                </div>
                                <p className="font-mono text-xs text-foreground truncate">{project.outputDir}</p>
                            </div>
                        )}
                    </div>

                    {projectBusy && (
                        <Alert variant="info">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="text-xs">
                                A deployment is running. Wait for it to finish before starting another.
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>

                <Separator />

                <CardFooter className="flex gap-2 pt-4">
                    <Button onClick={handleDeploy} disabled={isDeploying || projectBusy} className="flex-1">
                        <Rocket className="h-4 w-4" />
                        {isDeploying ? "Deploying..." : "Deploy"}
                    </Button>
                    <Button variant="outline" size="icon" onClick={handleDeleteClick} disabled={isDeleting}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </CardFooter>
            </Card>

            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Project?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete <span className="font-semibold text-foreground">{project.name}</span> and all its
                            deployments. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteConfirm}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete Project
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
