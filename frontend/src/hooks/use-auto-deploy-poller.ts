import { useEffect, useRef } from 'react'
import { deploymentsService } from '@/services/deployments.service'
import { useFilecoinUpload } from './use-filecoin-upload'
import { useToast } from '@/context/toast-context'
import type { Deployment } from '@/types'
import { useAppKitAccount } from '@reown/appkit/react'
import { useWalletClient } from 'wagmi'

const POLL_INTERVAL_MS = 5_000
const ENS_REJECTION_COOLDOWN_MS = 60_000

function isUserRejectedRequest(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: number }).code
  if (code === 4001) return true
  const message = (error as Error).message?.toLowerCase() ?? ''
  return message.includes('user rejected') || message.includes('rejected the request')
}

function isDocumentVisible() {
  if (typeof document === 'undefined') return true
  return document.visibilityState === 'visible'
}

export function useAutoDeployPoller(enabled = true) {
  const { uploadFile } = useFilecoinUpload()
  const { showToast } = useToast()
  const processingRef = useRef(false)
  const rejectionRef = useRef(new Map<string, number>())
  const inFlightRef = useRef(new Set<string>())
  const { address } = useAppKitAccount()
  const { data: walletClient } = useWalletClient()

  useEffect(() => {
    if (!enabled) {
      return
    }

    let cancelled = false
    let timer: number | undefined

    const processDeployment = async (deployment: Deployment) => {
      if (inFlightRef.current.has(deployment.id)) {
        return
      }
      inFlightRef.current.add(deployment.id)
      if (!walletClient || !address) {
        console.warn('[AutoDeployPoller] Wallet not ready, skipping deployment')
        inFlightRef.current.delete(deployment.id)
        return
      }

      const skipUpload = deployment.status === 'awaiting_signature'
      let cid = deployment.ipfsCid ?? null
      let stage: 'download' | 'upload' | 'prepare' | 'sign' | 'confirm' | 'idle' = 'idle'
      console.log('[AutoDeployPoller] Starting processing', {
        deploymentId: deployment.id,
        status: deployment.status,
        skipUpload,
      })

      try {
        if (!skipUpload) {
          stage = 'upload'
          console.log('[AutoDeployPoller] Uploading backend CAR artifact to Filecoin', {
            deploymentId: deployment.id,
          })
          cid = await uploadFile(deployment.id, {
            deploymentId: deployment.id,
            projectId: deployment.projectId,
          })
        }

        if (!cid) {
          throw new Error('Missing IPFS CID for ENS update')
        }

        stage = 'prepare'
        console.log('[AutoDeployPoller] Preparing ENS payload', { deploymentId: deployment.id, cid })
        const prepareResponse = await deploymentsService.prepareEns(deployment.id, cid)

        if (
          prepareResponse.payload.chainId &&
          walletClient.chain &&
          walletClient.chain.id !== prepareResponse.payload.chainId
        ) {
          const error: Error & { code?: string } = new Error(
            'Wallet connected to wrong network. Please switch to Ethereum mainnet.'
          )
          error.code = 'CHAIN_MISMATCH'
          throw error
        }

        stage = 'sign'
        console.log('[AutoDeployPoller] Requesting wallet signature', {
          deploymentId: deployment.id,
          resolver: prepareResponse.payload.resolverAddress,
        })
        const txHash = await walletClient.sendTransaction({
          account: address as `0x${string}`,
          to: prepareResponse.payload.resolverAddress as `0x${string}`,
          data: prepareResponse.payload.data as `0x${string}`,
        })

        stage = 'confirm'
        console.log('[AutoDeployPoller] Waiting for ENS confirmation', { deploymentId: deployment.id, txHash })
        await deploymentsService.confirmEns(deployment.id, txHash)

        const label = deployment.commitSha?.slice(0, 7) ?? deployment.id.slice(0, 6)
        showToast(`Deployed ${label}`, 'success')
        console.log('[AutoDeployPoller] Deployment completed', { deploymentId: deployment.id, txHash })
        rejectionRef.current.delete(deployment.id)
      } catch (error) {
        if (isUserRejectedRequest(error)) {
          rejectionRef.current.set(deployment.id, Date.now())
          console.warn('[AutoDeployPoller] ENS signature rejected', error)
          showToast('ENS signature rejected. Reopen the deployment to finish publishing when ready.', 'info')
          return
        }

        const message = error instanceof Error ? error.message : 'Upload failed'

        if (stage === 'upload' || stage === 'prepare') {
          try {
            await deploymentsService.markUploadFailed(deployment.id, message)
          } catch (markError) {
            console.error('[AutoDeployPoller] failed to mark deployment as failed', markError)
          }
        }

        console.error('[AutoDeployPoller] deployment failed', error)
        // Silently fail - no error toast
      } finally {
        inFlightRef.current.delete(deployment.id)
      }
    }

    const poll = async () => {
      if (cancelled || processingRef.current || !isDocumentVisible()) {
        return
      }

      processingRef.current = true
      try {
        if (!walletClient || !address) {
          return
        }

        const [pending, uploadingDeployments, awaitingSignature] = await Promise.all([
          deploymentsService.list({ status: 'pending_upload', limit: 10 }),
          deploymentsService.list({ status: 'uploading', limit: 10 }),
          deploymentsService.list({ status: 'awaiting_signature', limit: 10 }),
        ])

        const candidates = [
          ...pending,
          ...uploadingDeployments.filter((deployment) => !deployment.ipfsCid),
          ...awaitingSignature,
        ]
        const seen = new Set<string>()
        for (const deployment of candidates) {
          if (seen.has(deployment.id)) {
            continue
          }
          seen.add(deployment.id)

          const lastRejection = rejectionRef.current.get(deployment.id)
          if (lastRejection && Date.now() - lastRejection < ENS_REJECTION_COOLDOWN_MS) {
            continue
          }

          if (cancelled) {
            break
          }
          await processDeployment(deployment)
        }
      } catch (error) {
        console.error('[AutoDeployPoller] poll error', error)
      } finally {
        processingRef.current = false
      }
    }

    void poll()
    timer = window.setInterval(() => {
      void poll()
    }, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      if (timer) {
        clearInterval(timer)
      }
    }
  }, [enabled, uploadFile, showToast, walletClient, address])
}
