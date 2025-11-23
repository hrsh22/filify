import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useWalletClient } from "wagmi";
import { useAppKitAccount } from "@reown/appkit/react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
            showToast("Missing IPFS CID for this deployment", "error");
            return;
        }
        if (!walletClient || !address) {
            showToast("Connect your Ethereum wallet to sign the ENS update", "error");
            return;
        }
        try {
            setSigningEns(true);
            const prepareResponse = await deploymentsService.prepareEns(deployment.id, deployment.ipfsCid);

            if (prepareResponse.payload.chainId && walletClient.chain && walletClient.chain.id !== prepareResponse.payload.chainId) {
                showToast("Switch your wallet to Ethereum mainnet to finish this ENS update.", "error");
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
                showToast("Failed to submit ENS update", "error");
            }
        } finally {
            setSigningEns(false);
        }
    };

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
                    {deployment.projectId ? (
                        <Button variant="ghost" onClick={() => navigate(`/projects/${deployment.projectId}`)}>
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </Button>
                    ) : null}
                    <DeploymentStatusBadge status={deployment.status} />
                    {deployment.triggeredBy ? (
                        <Badge variant="outline" className="uppercase tracking-wide text-[10px]">
                            {deployment.triggeredBy === "webhook" ? "Auto" : "Manual"}
                        </Badge>
                    ) : null}
                    <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
                        <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
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
                            <div className="space-y-3 rounded-xl bg-muted/30 p-6 shadow-neo-inset">
                                <p className="text-base font-bold text-primary">Uploading build output to Filecoin…</p>
                                <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                                    Uploads kick off automatically every few seconds. Keep this tab open (and in the foreground) so the browser can
                                    finish sending artifacts to Filecoin.
                                </p>
                                <p className="text-xs font-semibold text-muted-foreground">
                                    This status will update once the upload completes and ENS is refreshed.
                                </p>
                            </div>
                        ) : null}

                        {isAwaitingSignature ? (
                            <div className="space-y-3 rounded-xl bg-blue-500/10 p-6 shadow-neo-sm border border-blue-500/20">
                                <p className="text-base font-bold text-blue-400">Waiting for ENS signature</p>
                                <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                                    Your wallet needs to publish the latest IPFS CID to ENS. Click the button below to open the signing prompt.
                                </p>
                                <Button variant="default" onClick={handleSignEns} disabled={!canSignEns || signingEns} className="shadow-neo-sm">
                                    {signingEns ? "Waiting for wallet…" : "Sign ENS update"}
                                </Button>
                                {!canSignEns ? (
                                    <p className="text-xs font-semibold text-muted-foreground">Connect your wallet to sign this ENS transaction.</p>
                                ) : null}
                            </div>
                        ) : null}

                        {isAwaitingConfirmation ? (
                            <div className="space-y-3 rounded-xl bg-amber-500/10 p-6 shadow-neo-sm border border-amber-500/20">
                                <p className="text-base font-bold text-amber-400">Waiting for Ethereum confirmation…</p>
                                <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                                    The ENS transaction was broadcast and is waiting to finalize. This usually takes a few seconds.
                                </p>
                                {etherscanUrl ? (
                                    <a
                                        href={etherscanUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-sm font-semibold text-orange underline-offset-4 hover:underline">
                                        View transaction on Etherscan →
                                    </a>
                                ) : null}
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
                            <p className="font-medium text-muted-foreground">Trigger</p>
                            <p className="font-bold capitalize">{deployment.triggeredBy ?? "—"}</p>
                        </div>
                        {deployment.commitSha ? (
                            <div>
                                <p className="font-medium text-muted-foreground">Commit</p>
                                <a
                                    href={project?.repoUrl ? `${project.repoUrl}/commit/${deployment.commitSha}` : undefined}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-mono text-xs font-bold text-cyan underline-offset-4 hover:underline">
                                    {deployment.commitSha.slice(0, 7)} –{" "}
                                    {deployment.commitMessage
                                        ? `${deployment.commitMessage.slice(0, 40)}${deployment.commitMessage.length > 40 ? "…" : ""}`
                                        : "View on GitHub"}
                                </a>
                            </div>
                        ) : null}
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
                            {deployment.ensTxHash && etherscanUrl ? (
                                <a
                                    href={etherscanUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-mono text-xs font-bold text-cyan underline-offset-4 hover:underline break-all">
                                    {deployment.ensTxHash}
                                </a>
                            ) : (
                                <p className="font-mono text-xs font-bold">—</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <DeploymentLogs logs={deployment.buildLog} />
        </div>
    );
}
