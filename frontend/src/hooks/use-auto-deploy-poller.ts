import { useEffect, useRef } from 'react'
import { deploymentsService } from '@/services/deployments.service'
import { downloadBuildFiles } from '@/services/build-artifacts.service'
import { useFilecoinUpload } from './use-filecoin-upload'
import { useToast } from '@/context/toast-context'
import type { Deployment } from '@/types'

const POLL_INTERVAL_MS = 5_000

function isDocumentVisible() {
  if (typeof document === 'undefined') return true
  return document.visibilityState === 'visible'
}

export function useAutoDeployPoller(enabled = true) {
  const { uploadFile } = useFilecoinUpload()
  const { showToast } = useToast()
  const processingRef = useRef(false)

  useEffect(() => {
    if (!enabled) {
      return
    }

    let cancelled = false
    let timer: number | undefined

    const processDeployment = async (deployment: Deployment) => {
      try {
        const files = await downloadBuildFiles(deployment.id)
        const cid = await uploadFile(files, {
          deploymentId: deployment.id,
          projectId: deployment.projectId,
        })
        await deploymentsService.updateEns(deployment.id, cid)
        const label = deployment.commitSha?.slice(0, 7) ?? deployment.id.slice(0, 6)
        showToast(`Auto deployed ${label}`, 'success')
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Upload failed'
        await deploymentsService.markUploadFailed(deployment.id, message)
        console.error('[AutoDeployPoller] upload failed', error)
        showToast(`Auto deploy failed: ${message}`, 'error')
      }
    }

    const poll = async () => {
      if (cancelled || processingRef.current || !isDocumentVisible()) {
        return
      }

      processingRef.current = true
      try {
        const [pending, uploading] = await Promise.all([
          deploymentsService.list({ status: 'pending_upload', limit: 10 }),
          deploymentsService.list({ status: 'uploading', limit: 10 }),
        ])
        const candidates = [...pending, ...uploading.filter((deployment) => !deployment.ipfsCid)]
        const seen = new Set<string>()
        for (const deployment of candidates) {
          if (seen.has(deployment.id)) {
            continue
          }
          seen.add(deployment.id)
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
  }, [enabled, uploadFile, showToast])
}



