/**
 * Union type for upload input - supports both single file and folder (array of files)
 */
export type UploadInput = File | File[]

/**
 * Helper function to check if input is a folder (array of files)
 */
export function isFolder(input: UploadInput): input is File[] {
    return Array.isArray(input)
}

/**
 * Helper function to get display name from upload input
 */
export function getUploadDisplayName(input: UploadInput): string {
    if (isFolder(input)) {
        // Extract folder name from first file's webkitRelativePath
        if (input.length > 0 && input[0].webkitRelativePath) {
            const pathParts = input[0].webkitRelativePath.split('/')
            return pathParts[0] || 'folder'
        }
        return 'folder'
    }
    return input.name
}

/**
 * Helper function to get total size from upload input
 */
export function getUploadTotalSize(input: UploadInput): number {
    if (isFolder(input)) {
        return input.reduce((total, file) => total + file.size, 0)
    }
    return input.size
}
