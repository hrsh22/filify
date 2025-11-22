import JSZip from 'jszip'
import { api } from './api'
import type { UploadInput } from '@/types/upload/input'

const HTML_EXTENSIONS = new Set(['.html', '.htm'])
const IGNORED_PATH_SEGMENTS = new Set([
  '.git',
  '.github',
  '.gitignore',
  '.gitmodules',
  'node_modules',
])

async function fetchViaApi(deploymentId: string): Promise<ArrayBuffer | null> {
  try {
    const response = await api.get<ArrayBuffer>(`/deployments/${deploymentId}/artifacts`, { responseType: 'arraybuffer' })
    return response.data
  } catch (error) {
    return null
  }
}

async function fetchViaStaticPath(deploymentId: string): Promise<ArrayBuffer> {
  const backendBase = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, '')
  const buildsBase = `${backendBase}/builds`
  const response = await fetch(`${buildsBase}/${deploymentId}.zip`, {
    credentials: 'include',
  })
  if (!response.ok) {
    throw new Error('Failed to download build artifact')
  }
  return await response.arrayBuffer()
}

function normalizeEntryPath(entryName: string): string {
  if (!entryName) {
    return ''
  }
  let normalized = entryName.replace(/\\/g, '/').trim()
  normalized = normalized.replace(/^(\.\/)+/, '')
  normalized = normalized.replace(/^\/+/, '')
  normalized = normalized.replace(/\/+/g, '/')
  normalized = normalized.replace(/\/$/, '')
  return normalized
}

function splitPathSegments(path: string): string[] {
  return path.split('/').filter((segment) => segment.length > 0)
}

function getCommonPrefixSegments(paths: string[]): string[] {
  if (paths.length === 0) return []
  const splitPaths = paths.map(splitPathSegments).filter((segments) => segments.length > 0)

  if (splitPaths.length === 0) return []

  // Determine the minimum length to avoid out-of-bounds
  const minLength = Math.min(...splitPaths.map((segments) => segments.length))
  const prefix: string[] = []

  for (let i = 0; i < minLength; i++) {
    const candidate = splitPaths[0][i]
    if (splitPaths.every((segments) => segments[i] === candidate)) {
      prefix.push(candidate)
    } else {
      break
    }
  }

  if (prefix.length === 0) {
    return []
  }

  const prefixLength = prefix.length
  const hasFileOutsidePrefix = splitPaths.some((segments) => segments.length > prefixLength)

  return hasFileOutsidePrefix ? prefix : []
}

function stripPrefix(path: string, prefixSegments: string[]): string {
  if (prefixSegments.length === 0) return path
  const segments = splitPathSegments(path)
  for (let i = 0; i < prefixSegments.length; i++) {
    if (segments[i] !== prefixSegments[i]) {
      return path
    }
  }
  const remaining = segments.slice(prefixSegments.length)
  return remaining.join('/')
}

function attachRelativePathMetadata(file: File, relativePath: string): File {
  try {
    Object.defineProperty(file, 'webkitRelativePath', {
      value: relativePath,
    })
  } catch {
    // ignore if browser does not allow overriding
  }

  try {
    Object.defineProperty(file, 'path', {
      value: relativePath,
    })
  } catch {
    // ignore if browser does not allow overriding
  }

  return file
}

function createFileWithRelativePath(blob: Blob, relativePath: string): File {
  const pathSegments = splitPathSegments(relativePath)
  const fileName = pathSegments[pathSegments.length - 1] ?? relativePath
  const file = new File([blob], fileName, {
    type: blob.type || 'application/octet-stream',
    lastModified: Date.now(),
  })
  return attachRelativePathMetadata(file, relativePath)
}

function getRelativePath(file: File): string {
  return file.webkitRelativePath || (file as File & { path?: string }).path || file.name
}

function isHtmlFile(file: File): boolean {
  const relativePath = getRelativePath(file).toLowerCase()
  const lastDot = relativePath.lastIndexOf('.')
  if (lastDot === -1) return false
  const ext = relativePath.slice(lastDot)
  return HTML_EXTENSIONS.has(ext)
}

function formatSamplePaths(files: File[]): string[] {
  return files.slice(0, 5).map((file) => getRelativePath(file))
}

/**
 * Downloads build artifacts and returns either:
 * - A single HTML File for simple static HTML sites (uses single-file upload)
 * - An array of Files for complex projects (uses folder upload)
 */
export async function downloadBuildFiles(deploymentId: string): Promise<UploadInput> {
  console.info(`[Artifacts] Starting download for deployment ${deploymentId}`)
  const buffer = (await fetchViaApi(deploymentId)) ?? (await fetchViaStaticPath(deploymentId))
  console.info(`[Artifacts] Download complete (${Math.round(buffer.byteLength / 1024)} KB). Extracting zip...`)
  const zip = await JSZip.loadAsync(buffer)
  const entries = Object.values(zip.files)
  const fileEntries = entries.filter((entry) => !entry.dir)

  if (fileEntries.length === 0) {
    throw new Error('No files found in downloaded artifact')
  }

  const normalizedPaths = fileEntries
    .map((entry) => normalizeEntryPath(entry.name))
    .filter((path) => path.length > 0)

  if (normalizedPaths.length === 0) {
    throw new Error('Artifact entries could not be normalized')
  }

  const prefixSegments = getCommonPrefixSegments(normalizedPaths)

  const files: File[] = []
  await Promise.all(
    fileEntries.map(async (entry) => {
      const normalizedPath = normalizeEntryPath(entry.name)
      if (!normalizedPath) return
      const relativePath = stripPrefix(normalizedPath, prefixSegments)
      if (!relativePath || relativePath.endsWith('/')) return

      const firstSegment = splitPathSegments(relativePath)[0]
      if (firstSegment && IGNORED_PATH_SEGMENTS.has(firstSegment)) {
        return
      }

      const data = await entry.async('blob')
      const file = createFileWithRelativePath(data, relativePath)
      files.push(file)
    })
  )

  if (files.length === 0) {
    throw new Error('No file entries were processed from artifact')
  }

  const sorted = files.sort((a, b) => getRelativePath(a).localeCompare(getRelativePath(b)))
  console.info(`[Artifacts] Prepared ${sorted.length} file(s). Sample:`, formatSamplePaths(sorted))

  if (sorted.length === 1 && !isHtmlFile(sorted[0])) {
    const onlyPath = getRelativePath(sorted[0])
    throw new Error(
      `Artifact contains a single file (${onlyPath}) that is not HTML. Either upload a valid HTML file or ensure the build outputs a folder with index.html`
    )
  }

  const isSingleHtmlFile = sorted.length === 1 && isHtmlFile(sorted[0])

  if (isSingleHtmlFile) {
    const htmlPath = getRelativePath(sorted[0])
    console.info(`[Artifacts] Single HTML file detected (${htmlPath}). Using single-file upload path.`)
    return sorted[0]
  }

  if (!sorted.some(isHtmlFile)) {
    console.info('[Artifacts] No HTML files detected in artifact; proceeding with folder upload to preserve assets.')
  }

  console.info(`[Artifacts] Using folder upload for ${sorted.length} file(s). Example paths:`, formatSamplePaths(sorted))
  return sorted
}


