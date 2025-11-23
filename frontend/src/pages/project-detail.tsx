import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { AxiosError } from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Rocket, ExternalLink, Globe, GitBranch, Terminal, FolderOutput, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProject } from "@/hooks/use-project";
import { deploymentsService } from "@/services/deployments.service";
import { projectsService } from "@/services/projects.service";
import { repositoriesService } from "@/services/repositories.service";
import { useToast } from "@/context/toast-context";
import { DeploymentStatusBadge } from "@/components/deployments/deployment-status-badge";
import { useAutoDeployPoller } from "@/hooks/use-auto-deploy-poller";

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
    const [branchOptions, setBranchOptions] = useState<string[]>([]);
    const [branchLoading, setBranchLoading] = useState(false);
    const [branchSaving, setBranchSaving] = useState(false);
    const [webhookUpdating, setWebhookUpdating] = useState(false);
    const [selectedBranch, setSelectedBranch] = useState("main");
    useAutoDeployPoller(true);

    const latestDeployment = project?.deployments?.[0];
    const projectBusy = useMemo(() => Boolean(latestDeployment && ACTIVE_STATUSES.has(latestDeployment.status)), [latestDeployment]);

    const handleWebhookToggle = async () => {
        if (!project) return;
        try {
            setWebhookUpdating(true);
            if (project.webhookEnabled) {
                await projectsService.disableWebhook(project.id);
                showToast("Webhook disabled", "info");
            } else {
                await projectsService.enableWebhook(project.id, selectedBranch);
                showToast("Webhook enabled", "success");
            }
            await refresh();
        } catch (error) {
            console.error("[ProjectDetail][webhook]", error);
            // Silently fail - no error toast
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
            showToast("Branch updated", "success");
            await refresh();
        } catch (error) {
            console.error("[ProjectDetail][branch]", error);
            // Silently fail - no error toast
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
                // Silently fail - no error toast
            })
            .finally(() => setBranchLoading(false));
    }, [project?.repoName, showToast]);

    const handleDeploy = async () => {
        if (!project) return;
        try {
            setIsDeploying(true);
            const { deploymentId } = await deploymentsService.create(project.id);
            showToast("Deployment started", "success");
            navigate(`/deployments/${deploymentId}`);
        } catch (err) {
            console.error("[ProjectDetail][deploy]", err);
            // Silently fail - no error toast
        } finally {
            setIsDeploying(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <Spinner size="lg" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-4">
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
                <Button variant="outline" onClick={() => navigate("/dashboard")}>
                    <ArrowLeft className="h-4 w-4" />
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
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-2">
                    <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="pl-0">
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </Button>
                    <div className="flex items-center gap-2">
                        <Rocket className="h-5 w-5 text-primary" />
                        <span className="text-sm font-medium text-primary">Project</span>
                    </div>
                    <h1 className="text-4xl font-bold tracking-tight">{project.name}</h1>
                    <a
                        href={project.repoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-smooth">
                        {project.repoName}
                        <ExternalLink className="h-4 w-4" />
                    </a>
                </div>
                <Button onClick={handleDeploy} disabled={isDeploying || projectBusy} size="lg">
                    <Rocket className="h-4 w-4" />
                    {isDeploying ? "Deploying..." : projectBusy ? "Deployment running" : "Deploy now"}
                </Button>
            </div>

            {projectBusy && (
                <Alert variant="info">
                    <AlertDescription>A deployment is currently running. Wait until it completes before starting a new one.</AlertDescription>
                </Alert>
            )}

            <Separator />

            {/* Tabs */}
            <Tabs defaultValue="overview" className="space-y-6">
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="deployments">Deployments</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription className="flex items-center gap-2">
                                    <Globe className="h-4 w-4" />
                                    ENS Domain
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-lg font-semibold text-primary">{project.ensName}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription className="flex items-center gap-2">
                                    <GitBranch className="h-4 w-4" />
                                    Branch
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-lg font-semibold">{project.repoBranch}</p>
                            </CardContent>
                        </Card>
                        {project.buildCommand && (
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardDescription className="flex items-center gap-2">
                                        <Terminal className="h-4 w-4" />
                                        Build Command
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm font-mono truncate">{project.buildCommand}</p>
                                </CardContent>
                            </Card>
                        )}
                        {project.outputDir && (
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardDescription className="flex items-center gap-2">
                                        <FolderOutput className="h-4 w-4" />
                                        Output Directory
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm font-mono truncate">{project.outputDir}</p>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="deployments" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Deployment History</CardTitle>
                            <CardDescription>All deployments for this project</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {project.deployments && project.deployments.length > 0 ? (
                                <div className="space-y-3">
                                    {project.deployments.map((deployment) => (
                                        <div
                                            key={deployment.id}
                                            className="group rounded-lg border p-4 transition-smooth hover:border-primary/50 hover:bg-accent/50">
                                            <div className="flex flex-wrap items-center justify-between gap-4">
                                                <div className="space-y-2 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <DeploymentStatusBadge status={deployment.status} />
                                                        {deployment.triggeredBy && (
                                                            <Badge variant="outline" className="text-xs">
                                                                {deployment.triggeredBy === "webhook" ? "Auto" : "Manual"}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        <Clock className="h-3 w-3" />
                                                        {formatDistanceToNow(new Date(deployment.createdAt), { addSuffix: true })}
                                                    </div>
                                                    {deployment.commitSha && (
                                                        <a
                                                            href={`${project.repoUrl}/commit/${deployment.commitSha}`}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="block text-xs text-primary hover:underline underline-offset-2 truncate">
                                                            {deployment.commitSha.slice(0, 7)}
                                                            {deployment.commitMessage &&
                                                                ` – ${deployment.commitMessage.slice(0, 40)}${deployment.commitMessage.length > 40 ? "…" : ""}`}
                                                        </a>
                                                    )}
                                                    {deployment.ipfsCid && (
                                                        <a
                                                            href={`https://${deployment.ipfsCid}.ipfs.dweb.link`}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="block text-xs text-primary hover:underline underline-offset-2">
                                                            IPFS: {deployment.ipfsCid.slice(0, 12)}...
                                                        </a>
                                                    )}
                                                </div>
                                                <Button variant="outline" size="sm" onClick={() => navigate(`/deployments/${deployment.id}`)}>
                                                    View
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-8">No deployments yet.</p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="settings" className="space-y-4">
                    <Card>
                    <CardHeader>
                        <CardTitle>Webhook Settings</CardTitle>
                        <CardDescription>Enable GitHub webhooks to trigger deployments whenever you push to the selected branch.</CardDescription>
                    </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Badge variant={project.webhookEnabled ? "success" : "outline"}>
                                            {project.webhookEnabled ? "Active" : "Inactive"}
                                        </Badge>
                                        <span className="text-sm text-muted-foreground">
                                            Branch:{" "}
                                            <span className="font-medium text-foreground">
                                                {project.autoDeployBranch ?? project.repoBranch ?? "main"}
                                            </span>
                                        </span>
                                    </div>
                                </div>
                                <Button
                                    onClick={handleWebhookToggle}
                                    disabled={webhookUpdating}
                                    variant={project.webhookEnabled ? "outline" : "default"}>
                                    {webhookUpdating ? "Saving…" : project.webhookEnabled ? "Disable" : "Enable"}
                                </Button>
                            </div>

                            <Separator />

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Deployment Branch</label>
                                <Select
                                    value={selectedBranch}
                                    onValueChange={handleBranchChange}
                                    disabled={branchLoading || branchSaving || webhookUpdating}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a branch" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {branchValues.map((branch) => (
                                            <SelectItem key={branch} value={branch}>
                                                {branch}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {branchLoading && <p className="text-xs text-muted-foreground">Loading branches…</p>}
                                <p className="text-xs text-muted-foreground">Deployments will trigger automatically when you push to this branch.</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
