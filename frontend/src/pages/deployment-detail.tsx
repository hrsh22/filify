import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeploymentStatusBadge } from "@/components/deployments/deployment-status-badge";
import { DeploymentSteps } from "@/components/deployments/deployment-steps";
import { DeploymentLogs } from "@/components/deployments/deployment-logs";
import { useDeploymentStatus } from "@/hooks/use-deployment-status";
import { useProject } from "@/hooks/use-project";
import { useToast } from "@/context/toast-context";
import { deploymentsService } from "@/services/deployments.service";
import { downloadBuildFiles } from "@/services/build-artifacts.service";
import { useFilecoinUpload } from "@/hooks/use-filecoin-upload";
import type { DeploymentStatus } from "@/types";

const CANCELLABLE_STATUSES = new Set<DeploymentStatus>(["cloning", "building", "uploading", "updating_ens"]);

export function DeploymentDetailPage() {
    const { deploymentId } = useParams<{ deploymentId: string }>();
    const navigate = useNavigate();
    const { deployment, loading, error, refresh } = useDeploymentStatus(deploymentId);
    const { project } = useProject(deployment?.projectId);
    const { showToast } = useToast();
    const { uploadFile, uploadState } = useFilecoinUpload();
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [cancelling, setCancelling] = useState(false);
    const autoUploadRef = useRef(false);

    useEffect(() => {
        autoUploadRef.current = false;
    }, [deploymentId]);

    useEffect(() => {
        if (!deployment || !deploymentId) return;
        if (deployment.status === "uploading" && !deployment.ipfsCid && !autoUploadRef.current) {
            autoUploadRef.current = true;
            void handleUpload();
        }
    }, [deployment, deploymentId]);

    const handleUpload = async () => {
        if (!deploymentId) return;
        try {
            setUploading(true);
            setUploadError(null);
            const files = await downloadBuildFiles(deploymentId);
            const cid = await uploadFile(files, {
                deploymentId,
                projectId: deployment?.projectId ?? ""
            });
            await deploymentsService.updateEns(deploymentId, cid);
            showToast("Uploaded build to Filecoin", "success");
            await refresh();
        } catch (err) {
            console.error("[DeploymentDetail][upload]", err);
            autoUploadRef.current = false;
            setUploadError(err instanceof Error ? err.message : "Upload failed");
            showToast("Filecoin upload failed", "error");
        } finally {
            setUploading(false);
        }
    };

    const handleCancel = async () => {
        if (!deploymentId) return;
        try {
            setCancelling(true);
            await deploymentsService.cancel(deploymentId);
            showToast("Deployment cancelled", "info");
            await refresh();
        } catch (err) {
            console.error("[DeploymentDetail][cancel]", err);
            showToast("Failed to cancel deployment", "error");
        } finally {
            setCancelling(false);
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

    if (!deployment) {
        return null;
    }

    const isWaitingForUpload = deployment.status === "uploading" && !deployment.ipfsCid;
    const ipfsUrl = deployment.ipfsCid ? `https://ipfs.io/ipfs/${deployment.ipfsCid}` : null;
    const ensUrl = project?.ensName ? `https://${project.ensName}.limo` : null;
    const etherscanUrl = deployment.ensTxHash ? `https://etherscan.io/tx/${deployment.ensTxHash}` : null;
    const isCancellable = CANCELLABLE_STATUSES.has(deployment.status);

    return (
        <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-2">
                    <p className="text-sm font-bold uppercase tracking-wide text-cyan">Deployment</p>
                    <h2 className="text-4xl font-bold text-foreground">#{deployment.id.slice(0, 8)}</h2>
                    <p className="text-base font-medium text-muted-foreground">
                        Started {formatDistanceToNow(new Date(deployment.createdAt), { addSuffix: true })}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <DeploymentStatusBadge status={deployment.status} />
                    <Button variant="outline" onClick={refresh}>
                        Refresh
                    </Button>
                    {isCancellable ? (
                        <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
                            {cancelling ? "Cancelling..." : "Cancel deployment"}
                        </Button>
                    ) : null}
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-[2fr,1fr]">
                <Card>
                    <CardHeader>
                        <CardTitle>Status</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <DeploymentSteps status={deployment.status} />
                        {isWaitingForUpload ? (
                            <div className="space-y-5 rounded-xl bg-muted/30 p-6 shadow-neo-inset">
                                <div className="space-y-2">
                                    <p className="text-base font-bold text-primary">Upload build output to Filecoin</p>
                                    <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                                        Backend finished building the project. Downloaded artifacts live in the server&apos;s <code className="rounded bg-black/20 px-1.5 py-0.5 font-mono text-xs">/builds</code>{" "}
                                        directory and are also available via the artifact endpoint.
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <Button onClick={handleUpload} disabled={uploading}>
                                        {uploading ? "Uploading…" : "Start upload"}
                                    </Button>
                                    {uploadError ? <p className="text-sm font-semibold text-destructive">{uploadError}</p> : null}
                                </div>
                                <div className="space-y-2 rounded-xl bg-card/50 p-4 text-xs font-medium shadow-neo-sm">
                                    {uploadState.stepStates.map((step) => (
                                        <div key={step.step} className="flex justify-between">
                                            <span className="capitalize text-muted-foreground">{step.step.replace("-", " ")}</span>
                                            <span className={step.status === "completed" ? "text-cyan font-semibold" : ""}>
                                                {step.status === "pending" ? "Pending" : step.status === "completed" ? "Done" : "In progress"}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null}

                        {deployment.status === "success" ? (
                            <div className="space-y-4 rounded-xl bg-emerald-500/10 p-6 shadow-neo-sm border border-emerald-500/20">
                                <p className="text-base font-bold text-emerald-400">Deployment complete 🎉</p>
                                <div className="space-y-2">
                                    {ipfsUrl ? (
                                        <a
                                            href={ipfsUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="block text-sm text-orange underline-offset-4 hover:underline font-semibold">
                                            View on IPFS →
                                        </a>
                                    ) : null}
                                    {ensUrl ? (
                                        <a
                                            href={ensUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="block text-sm text-orange underline-offset-4 hover:underline font-semibold">
                                            View ENS: {project?.ensName} →
                                        </a>
                                    ) : null}
                                    {etherscanUrl ? (
                                        <a
                                            href={etherscanUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="block text-sm text-orange underline-offset-4 hover:underline font-semibold">
                                            ENS transaction →
                                        </a>
                                    ) : null}
                                </div>
                            </div>
                        ) : deployment.status === "cancelled" ? (
                            <div className="rounded-xl bg-muted/30 p-5 text-sm font-medium text-muted-foreground shadow-neo-inset">
                                Deployment was cancelled before completion.
                            </div>
                        ) : null}
                        {deployment.status === "failed" && deployment.errorMessage ? (
                            <div className="rounded-xl bg-destructive/10 p-5 text-sm font-bold text-destructive shadow-neo-sm border border-destructive/20">
                                {deployment.errorMessage}
                            </div>
                        ) : null}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Metadata</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        <div>
                            <p className="font-medium text-muted-foreground">Project</p>
                            <p className="font-bold">{project?.name ?? project?.repoName ?? deployment.projectId}</p>
                        </div>
                        <div>
                            <p className="font-medium text-muted-foreground">ENS</p>
                            <p className="font-bold">{project?.ensName ?? "—"}</p>
                        </div>
                        <div>
                            <p className="font-medium text-muted-foreground">IPFS CID</p>
                            <p className="font-mono text-xs font-bold">{deployment.ipfsCid ?? "—"}</p>
                        </div>
                        <div>
                            <p className="font-medium text-muted-foreground">ENS Tx</p>
                            <p className="font-mono text-xs font-bold">{deployment.ensTxHash ?? "—"}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <DeploymentLogs logs={deployment.buildLog} />
        </div>
    );
}
