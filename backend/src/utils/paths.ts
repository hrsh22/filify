import path from 'path'

export function getBuildsRoot(): string {
    const cwd = process.cwd()
    if (path.basename(cwd) === 'backend') {
        return path.resolve(cwd, '..', 'builds')
    }
    return path.resolve(cwd, 'builds')
}

export function getDeploymentBuildDir(deploymentId: string): string {
    return path.join(getBuildsRoot(), deploymentId)
}

