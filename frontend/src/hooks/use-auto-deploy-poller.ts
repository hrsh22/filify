import { useEffect, useRef } from 'react'
import { deploymentsService } from '@/services/deployments.service'
import { useToast } from '@/context/toast-context'
import type { Deployment } from '@/types'
import { useAppKitAccount } from '@reown/appkit/react'
import { useWalletClient } from 'wagmi'

const POLL_INTERVAL_MS = 5_000

/**
 * Check if the error is a user rejection/cancellation.
 * Handles various wallet error formats:
 * - MetaMask: code 4001
 * - WalletConnect/viem: "User canceled" in message or Details section
 */
function isUserRejectedRequest(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const code = (error as { code?: number }).code
  if (code === 4001) return true

  // Get the full error message (including multi-line with Details:)
  const message = (error as Error).message ?? ''
  const messageLower = message.toLowerCase()

  // Check for rejection patterns in the message
  const rejectionPatterns = [
    'user rejected',
    'rejected the request',
    'user canceled',
    'user cancelled',
    'user denied',
    'details: user canceled',  // viem puts this in Details section
    'details: user cancelled',
  ]

  for (const pattern of rejectionPatterns) {
    if (messageLower.includes(pattern)) {
      return true
    }
  }

  // Also check error.details if it exists (some wallet errors have this property)
  const details = (error as { details?: string }).details
  if (details && typeof details === 'string') {
    const detailsLower = details.toLowerCase()
    if (detailsLower.includes('user canceled') || detailsLower.includes('user cancelled')) {
      return true
    }
  }

  // Check nested cause (viem wraps errors)
  const cause = (error as { cause?: unknown }).cause
  if (cause && typeof cause === 'object') {
    return isUserRejectedRequest(cause)
  }

  return false
}

function isDocumentVisible() {
  if (typeof document === 'undefined') return true
  return document.visibilityState === 'visible'
}

/**
 * Polls for deployments awaiting ENS signature.
 * 
 * Note: Filecoin upload is now handled by the backend.
 * This hook only processes ENS signature requests once the
 * backend has completed the build and upload (status: awaiting_signature).
 * 
 * If the user rejects/cancels the signature, the deployment is cancelled.
 */
export function useAutoDeployPoller(enabled = true) {
  const { showToast } = useToast()
  const processingRef = useRef(false)
  // Track deployments that are actively showing a wallet popup or being processed
  const activeSignaturesRef = useRef(new Set<string>())
  // Track deployments that have been cancelled (to prevent re-processing before status updates)
  const cancelledRef = useRef(new Set<string>())
  const { address } = useAppKitAccount()
  const { data: walletClient } = useWalletClient()

  useEffect(() => {
    if (!enabled) {
      return
    }

    let cancelled = false
    let timer: number | undefined

    const processDeployment = async (deployment: Deployment) => {
      // Skip if already processing this deployment or if it was cancelled
      if (activeSignaturesRef.current.has(deployment.id) || cancelledRef.current.has(deployment.id)) {
        console.log('[AutoDeployPoller] Skipping deployment (already processing or cancelled)', {
          deploymentId: deployment.id,
          isActive: activeSignaturesRef.current.has(deployment.id),
          isCancelled: cancelledRef.current.has(deployment.id),
        })
        return
      }

      // Mark as actively processing BEFORE any async work
      activeSignaturesRef.current.add(deployment.id)

      if (!walletClient || !address) {
        console.warn('[AutoDeployPoller] Wallet not ready, skipping deployment')
        activeSignaturesRef.current.delete(deployment.id)
        return
      }

      // Backend now handles upload - we only process awaiting_signature
      const cid = deployment.ipfsCid
      if (!cid) {
        console.warn('[AutoDeployPoller] Deployment missing IPFS CID, skipping', {
          deploymentId: deployment.id
        })
        activeSignaturesRef.current.delete(deployment.id)
        return
      }

      console.log('[AutoDeployPoller] Processing deployment for ENS signature', {
        deploymentId: deployment.id,
        cid,
      })

      try {
        // Step 1: Prepare ENS payload
        console.log('[AutoDeployPoller] Preparing ENS payload', { deploymentId: deployment.id, cid })
        const prepareResponse = await deploymentsService.prepareEns(deployment.id, cid)

        // Check chain ID matches
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

        // Step 2: Request wallet signature
        console.log('[AutoDeployPoller] Requesting wallet signature', {
          deploymentId: deployment.id,
          resolver: prepareResponse.payload.resolverAddress,
        })
        const txHash = await walletClient.sendTransaction({
          account: address as `0x${string}`,
          to: prepareResponse.payload.resolverAddress as `0x${string}`,
          data: prepareResponse.payload.data as `0x${string}`,
        })

        // Step 3: Confirm ENS transaction
        console.log('[AutoDeployPoller] Waiting for ENS confirmation', { deploymentId: deployment.id, txHash })
        await deploymentsService.confirmEns(deployment.id, txHash)

        const label = deployment.commitSha?.slice(0, 7) ?? deployment.id.slice(0, 6)
        showToast(`Deployed ${label}`, 'success')
        console.log('[AutoDeployPoller] Deployment completed', { deploymentId: deployment.id, txHash })
      } catch (error) {
        // Check if user rejected/cancelled the signature
        const isRejection = isUserRejectedRequest(error)
        console.log('[AutoDeployPoller] Error caught:', {
          isRejection,
          message: (error as Error)?.message?.substring(0, 200),
          deploymentId: deployment.id
        })

        if (isRejection) {
          // User rejected/cancelled the signature - cancel the deployment
          console.warn('[AutoDeployPoller] ENS signature rejected/cancelled, cancelling deployment', {
            deploymentId: deployment.id
          })

          // Mark as cancelled immediately to prevent re-processing
          cancelledRef.current.add(deployment.id)

          try {
            await deploymentsService.cancel(deployment.id)
            showToast('Deployment cancelled', 'info')
            console.log('[AutoDeployPoller] Deployment cancelled after signature rejection', {
              deploymentId: deployment.id
            })
          } catch (cancelError) {
            console.error('[AutoDeployPoller] Failed to cancel deployment', cancelError)
            showToast('Failed to cancel deployment', 'error')
            // Remove from cancelled set if cancel failed so user can retry
            cancelledRef.current.delete(deployment.id)
          }
          return
        }

        console.error('[AutoDeployPoller] ENS signing failed', error)
      } finally {
        activeSignaturesRef.current.delete(deployment.id)
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

        // Only poll for awaiting_signature - backend handles upload now
        const awaitingSignature = await deploymentsService.list({
          status: 'awaiting_signature',
          limit: 10
        })

        for (const deployment of awaitingSignature) {
          if (cancelled) {
            break
          }
          // processDeployment will skip if already active or cancelled
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
  }, [enabled, showToast, walletClient, address])
}
