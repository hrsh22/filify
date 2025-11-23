import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, RefreshCw, Rocket, ExternalLink } from "lucide-react";
import { useWalletClient } from "wagmi";
import { useAppKitAccount } from "@reown/appkit/react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { DeploymentStatusBadge } from "@/components/deployments/deployment-status-badge";
import { DeploymentSteps } from "@/components/deployments/deployment-steps";
import { DeploymentLogs } from "@/components/deployments/deployment-logs";
import { useDeploymentStatus } from "@/hooks/use-deployment-status";
import { useProject } from "@/hooks/use-project";
import { useToast } from "@/context/toast-context";
import { deploymentsService } from "@/services/deployments.service";
import type { DeploymentStatus } from "@/types";
import { useAutoDeployPoller } from "@/hooks/use-auto-deploy-poller";

const CANCELLABLE_STATUSES = new Set<DeploymentStatus>([
    "pending_build",
    "cloning",
    "building",
    "pending_upload",
    "uploading",
    "awaiting_signature",
    "awaiting_confirmation"
]);

function isUserRejectedRequest(error: unknown) {
    if (!error || typeof error !== "object") return false;
    const code = (error as { code?: number }).code;
    if (code === 4001) return true;
    const message = (error as Error).message?.toLowerCase() ?? "";
    return message.includes("user rejected") || message.includes("rejected the request");
}

export function DeploymentDetailPage() {
    const { deploymentId } = useParams<{ deploymentId: string }>();
    const navigate = useNavigate();
    const { deployment, loading, error, refresh } = useDeploymentStatus(deploymentId);
    const { project } = useProject(deployment?.projectId);
    const { showToast } = useToast();
    const [cancelling, setCancelling] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [signingEns, setSigningEns] = useState(false);
    const { address } = useAppKitAccount();
    const { data: walletClient } = useWalletClient();
    useAutoDeployPoller(true);

    const handleCancel = async () => {
        if (!deploymentId) return;
        try {
            setCancelling(true);
            await deploymentsService.cancel(deploymentId);
            showToast("Deployment cancelled", "info");
            await refresh();
        } catch (err) {
            console.error("[DeploymentDetail][cancel]", err);
            // Silently fail - no error toast
        } finally {
            setCancelling(false);
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

    if (!deployment) {
        return null;
    }

    const isWaitingForUpload = deployment.status === "pending_upload" || (deployment.status === "uploading" && !deployment.ipfsCid);
    const isAwaitingSignature = deployment.status === "awaiting_signature";
    const isAwaitingConfirmation = deployment.status === "awaiting_confirmation";
    const canSignEns = isAwaitingSignature && Boolean(walletClient && address);
    const ipfsUrl = deployment.ipfsCid ? `https://${deployment.ipfsCid}.ipfs.dweb.link` : null;
    const ensUrl = project?.ensName ? `https://${project.ensName}.limo` : null;
    const etherscanUrl = deployment.ensTxHash ? `https://etherscan.io/tx/${deployment.ensTxHash}` : null;
    const isCancellable = CANCELLABLE_STATUSES.has(deployment.status);

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await refresh();
        } finally {
            setRefreshing(false);
        }
    };

    const handleSignEns = async () => {
        if (!deployment) return;
        if (!deployment.ipfsCid) {
            // Silently fail - missing CID
            return;
        }
        if (!walletClient || !address) {
            // Silently fail - wallet not connected
            return;
        }
        try {
            setSigningEns(true);
            const prepareResponse = await deploymentsService.prepareEns(deployment.id, deployment.ipfsCid);

            if (prepareResponse.payload.chainId && walletClient.chain && walletClient.chain.id !== prepareResponse.payload.chainId) {
                // Silently fail - wrong chain
                return;
            }

            const txHash = await walletClient.sendTransaction({
                account: address as `0x${string}`,
                to: prepareResponse.payload.resolverAddress as `0x${string}`,
                data: prepareResponse.payload.data as `0x${string}`
            });

            await deploymentsService.confirmEns(deployment.id, txHash);
            showToast("ENS update submitted", "success");
            await refresh();
        } catch (err) {
            if (isUserRejectedRequest(err)) {
                showToast("ENS signature request rejected", "info");
            } else {
                console.error("[DeploymentDetail][signEns]", err);
                // Silently fail - no error toast
            }
        } finally {
            setSigningEns(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-2">
                    <Button variant="ghost" size="sm" onClick={() => deployment.projectId ? navigate(`/projects/${deployment.projectId}`) : navigate("/dashboard")} className="pl-0">
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </Button>
                    <div className="flex items-center gap-2">
                        <Rocket className="h-5 w-5 text-primary" />
                        <span className="text-sm font-medium text-primary">Deployment</span>
                    </div>
                    <h1 className="text-4xl font-bold tracking-tight">#{deployment.id.slice(0, 8)}</h1>
                    <p className="text-muted-foreground">
                        Started {formatDistanceToNow(new Date(deployment.createdAt), { addSuffix: true })}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <DeploymentStatusBadge status={deployment.status} />
                    {deployment.triggeredBy && (
                        <Badge variant="outline" className="text-xs">
                            {deployment.triggeredBy === "webhook" ? "Auto" : "Manual"}
                        </Badge>
                    )}
                    <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
                        <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                    </Button>
                    {isCancellable && (
                        <Button variant="destructive" size="sm" onClick={handleCancel} disabled={cancelling}>
                            {cancelling ? "Cancelling..." : "Cancel"}
                        </Button>
                    )}
                </div>
            </div>

            <Separator />

            <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
                {/* Status Column */}
                <div className="space-y-6">
                <Card>
                    <CardHeader>
                            <CardTitle>Progress</CardTitle>
                    </CardHeader>
                        <CardContent>
                        <DeploymentSteps status={deployment.status} />
                        </CardContent>
                    </Card>

                    {/* Status-specific messages */}
                    {isWaitingForUpload && (
                        <Alert variant="info">
                            <AlertDescription className="space-y-2">
                                <p className="font-semibold">Uploading to Filecoin</p>
                                <p className="text-sm">Keep this tab open so the browser can finish sending artifacts to Filecoin. This will update automatically once complete.</p>
                            </AlertDescription>
                        </Alert>
                    )}

                    {isAwaitingSignature && (
                        <Alert variant="warning">
                            <AlertDescription className="space-y-3">
                                <p className="font-semibold">ENS Signature Required</p>
                                <p className="text-sm">Your wallet needs to publish the latest IPFS CID to ENS.</p>
                                <Button onClick={handleSignEns} disabled={!canSignEns || signingEns} size="sm">
                                    {signingEns ? "Waiting for wallet…" : "Sign ENS update"}
                                </Button>
                                {!canSignEns && (
                                    <p className="text-xs text-muted-foreground">Connect your wallet to sign this ENS transaction.</p>
                                )}
                            </AlertDescription>
                        </Alert>
                    )}

                    {isAwaitingConfirmation && (
                        <Alert variant="warning">
                            <AlertDescription className="space-y-2">
                                <p className="font-semibold">Waiting for Ethereum confirmation</p>
                                <p className="text-sm">The ENS transaction was broadcast and is waiting to finalize.</p>
                                {etherscanUrl && (
                                    <a
                                        href={etherscanUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline underline-offset-2"
                                    >
                                        View on Etherscan
                                        <ExternalLink className="h-3 w-3" />
                                    </a>
                                )}
                            </AlertDescription>
                        </Alert>
                    )}

                    {deployment.status === "success" && (
                        <Alert variant="success">
                            <AlertDescription className="space-y-2">
                                <p className="font-semibold">Deployment complete 🎉</p>
                                <div className="flex flex-col gap-1">
                                    {ipfsUrl && (
                                        <a
                                            href={ipfsUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1 text-sm hover:underline underline-offset-2"
                                        >
                                            View on IPFS
                                            <ExternalLink className="h-3 w-3" />
                                        </a>
                                    )}
                                    {ensUrl && (
                                        <a
                                            href={ensUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1 text-sm hover:underline underline-offset-2"
                                        >
                                            View ENS: {project?.ensName}
                                            <ExternalLink className="h-3 w-3" />
                                        </a>
                                    )}
                                    {etherscanUrl && (
                                        <a
                                            href={etherscanUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1 text-sm hover:underline underline-offset-2"
                                        >
                                            ENS transaction
                                            <ExternalLink className="h-3 w-3" />
                                        </a>
                                    )}
                                </div>
                            </AlertDescription>
                        </Alert>
                    )}

                    {deployment.status === "failed" && deployment.errorMessage && (
                        <Alert variant="destructive">
                            <AlertDescription>{deployment.errorMessage}</AlertDescription>
                        </Alert>
                    )}

                    {deployment.status === "cancelled" && (
                        <Alert>
                            <AlertDescription>Deployment was cancelled before completion.</AlertDescription>
                        </Alert>
                    )}

                    <DeploymentLogs logs={deployment.buildLog} />
                            </div>

                {/* Metadata Sidebar */}
                <Card>
                    <CardHeader>
                        <CardTitle>Metadata</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                        <div>
                            <p className="text-muted-foreground mb-1">Project</p>
                            <p className="font-semibold">{project?.name ?? project?.repoName ?? deployment.projectId}</p>
                        </div>
                        <Separator />
                        <div>
                            <p className="text-muted-foreground mb-1">Trigger</p>
                            <p className="font-semibold capitalize">{deployment.triggeredBy ?? "—"}</p>
                        </div>
                        <Separator />
                        {deployment.commitSha && (
                            <>
                            <div>
                                    <p className="text-muted-foreground mb-1">Commit</p>
                                <a
                                    href={project?.repoUrl ? `${project.repoUrl}/commit/${deployment.commitSha}` : undefined}
                                    target="_blank"
                                    rel="noreferrer"
                                        className="font-mono text-xs text-primary hover:underline underline-offset-2 break-all"
                                    >
                                        {deployment.commitSha.slice(0, 7)}
                                        {deployment.commitMessage && ` – ${deployment.commitMessage.slice(0, 30)}${deployment.commitMessage.length > 30 ? "…" : ""}`}
                                </a>
                            </div>
                                <Separator />
                            </>
                        )}
                        <div>
                            <p className="text-muted-foreground mb-1">ENS</p>
                            <p className="font-semibold">{project?.ensName ?? "—"}</p>
                        </div>
                        <Separator />
                        <div>
                            <p className="text-muted-foreground mb-1">IPFS CID</p>
                            <p className="font-mono text-xs break-all">{deployment.ipfsCid ?? "—"}</p>
                        </div>
                        <Separator />
                        <div>
                            <p className="text-muted-foreground mb-1">ENS Transaction</p>
                            {deployment.ensTxHash && etherscanUrl ? (
                                <a
                                    href={etherscanUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-mono text-xs text-primary hover:underline underline-offset-2 break-all"
                                >
                                    {deployment.ensTxHash.slice(0, 10)}...
                                </a>
                            ) : (
                                <p className="font-mono text-xs">—</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
