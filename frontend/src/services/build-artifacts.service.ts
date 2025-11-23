import { api } from './api'

export interface CarArtifact {
  bytes: Uint8Array
  rootCid?: string
  carSize: number
  buildOutput?: string
}

type ProgressListener = (downloaded: number, totalBytes?: number) => void

export async function downloadCarArtifact(
  deploymentId: string,
  onProgress?: ProgressListener
): Promise<CarArtifact> {
  console.info(`[Artifacts] Requesting CAR for deployment ${deploymentId}`)
  const response = await api.get<ArrayBuffer>(`/deployments/${deploymentId}/car`, {
    responseType: 'arraybuffer',
    onDownloadProgress: (event) => {
      if (typeof event.total === 'number' && event.total > 0) {
        onProgress?.(event.loaded, event.total)
    } else {
        onProgress?.(event.loaded)
      }
    },
  })

  const buffer = response.data
  const bytes = new Uint8Array(buffer)
  const headers = response.headers ?? {}
  const rootCidHeader = (headers['x-root-cid'] ?? headers['X-Root-Cid']) as string | undefined
  const buildOutputHeader = (headers['x-build-output'] ?? headers['X-Build-Output']) as string | undefined
  const contentLengthHeader = (headers['content-length'] ?? headers['Content-Length']) as string | undefined
  const parsedSize = contentLengthHeader ? Number(contentLengthHeader) : Number.NaN
  const carSize = Number.isFinite(parsedSize) ? parsedSize : bytes.byteLength

  console.info('[Artifacts] CAR download completed', {
    deploymentId,
    kiloBytes: Math.round(bytes.byteLength / 1024),
    rootCid: rootCidHeader,
    buildOutput: buildOutputHeader,
  })

  return {
    bytes,
    rootCid: rootCidHeader,
    carSize,
    buildOutput: buildOutputHeader,
  }
}
