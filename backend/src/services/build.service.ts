import { exec, type ChildProcess, type ExecOptions } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { encryptionService } from './encryption.service';
import { logger } from '../utils/logger';
import { getBuildsRoot, getDeploymentBuildDir } from '../utils/paths';
import { buildCarFromDirectory } from '../utils/car-builder';

interface BuildResult {
    buildDir: string;
    outputDir: string;
    logs: string;
    carFilePath: string;
    carRootCid: string;
}

interface BuildOptions {
    buildCommand?: string | null;
    outputDir?: string | null;
    frontendDir?: string | null;
}

const OUTPUT_METADATA_FILENAME = '.output-dir';

class BuildService {
    private readonly BUILD_ROOT = getBuildsRoot();
    private readonly activeProcesses = new Map<string, ChildProcess>();
    private readonly ARTIFACT_TTL_MS = 24 * 60 * 60 * 1000;
    private readonly CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
    private cleanupTimer?: NodeJS.Timeout;

    constructor() {
        this.startCleanupTimer();
    }

    async cloneAndBuild(
        repoUrl: string,
        branch: string,
        encryptedToken: string,
        deploymentId: string,
        options: BuildOptions = {}
    ): Promise<BuildResult> {
        const buildDir = getDeploymentBuildDir(deploymentId);
        const { buildCommand, outputDir, frontendDir } = options;
        let logs = '';

        // Determine the working directory for the frontend (if frontendDir is specified)
        const frontendWorkingDir = frontendDir ? path.join(buildDir, frontendDir) : buildDir;

        logger.info('Starting clone and build process', {
            deploymentId,
            repoUrl,
            branch,
            buildDir,
            frontendDir: frontendDir || 'root',
            frontendWorkingDir,
            buildCommand: buildCommand || 'default',
            outputDir: outputDir || 'auto-detect',
        });

        try {
            // Ensure build root exists
            await fs.mkdir(this.BUILD_ROOT, { recursive: true });
            logger.debug('Build root directory ensured', { buildRoot: this.BUILD_ROOT });

            // Decrypt GitHub token
            logger.debug('Decrypting GitHub token for clone', { deploymentId });
            const token = encryptionService.decrypt(encryptedToken);

            // Clone repository with authentication
            logs += `Cloning repository: ${repoUrl} (branch: ${branch})\n`;
            if (frontendDir) {
                logs += `Frontend directory: ${frontendDir}\n`;
            }
            const authUrl = repoUrl.replace('https://', `https://${token}@`);

            logger.info('Cloning repository', {
                deploymentId,
                repoUrl,
                branch,
                buildDir,
                frontendDir,
            });

            await fs.rm(buildDir, { recursive: true, force: true }).catch(() => undefined);
            await this.runCommand(`git clone --single-branch --branch ${branch} ${authUrl} ${buildDir}`, deploymentId);
            logs += `✓ Repository cloned successfully\n\n`;
            logger.info('Repository cloned successfully', { deploymentId, buildDir });

            // Verify frontend directory exists if specified
            if (frontendDir) {
                try {
                    const stats = await fs.stat(frontendWorkingDir);
                    if (!stats.isDirectory()) {
                        throw new Error(`Frontend directory "${frontendDir}" exists but is not a directory`);
                    }
                    logs += `✓ Frontend directory found: ${frontendDir}\n\n`;
                } catch (error) {
                    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                        throw new Error(`Frontend directory "${frontendDir}" not found in repository`);
                    }
                    throw error;
                }
            }

            // Determine project type
            logs += `Checking project structure...\n`;
            const packageJsonPath = path.join(frontendWorkingDir, 'package.json');
            const hasPackageJson = await fs
                .access(packageJsonPath)
                .then(() => true)
                .catch(() => false);

            let packageJson: Record<string, any> | null = null;
            let projectType: 'nextjs' | 'node' | 'static' = 'static';
            if (hasPackageJson) {
                const parsed = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
                packageJson = parsed && typeof parsed === 'object' ? parsed : null;
            }

            if (packageJson) {
                const packageName = typeof packageJson.name === 'string' ? packageJson.name : 'app';
                logs += `✓ Found package.json: ${packageName}\n\n`;
                projectType = 'node';
                logger.debug('Detected Node.js project', { deploymentId, packageName });
                const hasNextDep =
                    typeof packageJson.dependencies?.next === 'string' ||
                    typeof packageJson.devDependencies?.next === 'string';
                if (hasNextDep) {
                    projectType = 'nextjs';
                    logs += `Detected Next.js project\n`;
                    logger.info('Detected Next.js project', { deploymentId, packageName });
                    // Ensure a static export config exists
                    const nextConfigPath = path.join(frontendWorkingDir, 'next.config.js');
                    const nextConfigMjsPath = path.join(frontendWorkingDir, 'next.config.mjs');
                    const nextConfigTsPath = path.join(frontendWorkingDir, 'next.config.ts');
                    let hasNextConfig = false;
                    for (const candidate of [nextConfigPath, nextConfigMjsPath, nextConfigTsPath]) {
                        try {
                            await fs.access(candidate);
                            hasNextConfig = true;
                            break;
                        } catch {
                            // continue
                        }
                    }
                    if (!hasNextConfig) {
                        logs += `⚠️  No next.config.js found. Creating one with static export configuration...\n`;
                        await fs.writeFile(
                            nextConfigPath,
                            `/** @type {import('next').NextConfig} */\nconst nextConfig = {\n  output: 'export',\n  trailingSlash: true,\n  images: {\n    unoptimized: true,\n  },\n}\n\nmodule.exports = nextConfig\n`
                        );
                        logs += `✓ Created next.config.js with static export settings\n\n`;
                    }
                }
            } else {
                logs += `⚠️  No package.json found — treating as static site\n\n`;
                logger.info('No package.json found, treating as static site', { deploymentId });
            }

            let detectedOutputDir: string;
            if (projectType === 'static') {
                detectedOutputDir = await this.prepareStaticOutput(frontendWorkingDir);
            } else {
                // Install dependencies
                logs += `Installing dependencies...\n`;
                logger.info('Installing dependencies', { deploymentId, frontendWorkingDir });
                const installResult = await this.runCommand('npm install', deploymentId, {
                    cwd: frontendWorkingDir,
                });
                logs += installResult.stdout + installResult.stderr;
                logs += `✓ Dependencies installed\n\n`;
                logger.info('Dependencies installed successfully', { deploymentId });

                // Build project
                logs += `Building project...\n`;
                const buildCmd = buildCommand ?? 'npm run build';
                logger.info('Building project', {
                    deploymentId,
                    buildCommand: buildCmd,
                    projectType,
                    frontendWorkingDir,
                });
                const buildResult = await this.runCommand(buildCmd, deploymentId, {
                    cwd: frontendWorkingDir,
                    env: {
                        ...process.env,
                        NODE_ENV: 'production',
                    },
                });
                logs += buildResult.stdout + buildResult.stderr;
                logs += `✓ Build completed\n\n`;
                logger.info('Build completed successfully', { deploymentId, buildCommand: buildCmd });

                detectedOutputDir = outputDir
                    ? path.join(frontendWorkingDir, outputDir)
                    : await this.detectOutputDir(frontendWorkingDir);
            }
            // Record detected output directory for later retrieval (relative to buildDir)
            const relativeOutputDir = path.relative(buildDir, detectedOutputDir) || '.';
            await fs.writeFile(path.join(buildDir, OUTPUT_METADATA_FILENAME), relativeOutputDir, 'utf-8');

            logs += `✓ Output directory detected: ${path.basename(detectedOutputDir)}\n`;

            const carFilePath = path.join(buildDir, 'artifact.car');
            logs += `Creating CAR file...\n`;
            const carResult = await buildCarFromDirectory(detectedOutputDir, deploymentId, carFilePath);
            logs += `✓ CAR generated (root CID: ${carResult.rootCid})\n`;
            logs += `Files included: ${carResult.summary.totalFiles}, directories: ${carResult.summary.totalDirectories}\n`;

            logger.info('Build process completed successfully', {
                deploymentId,
                buildDir,
                outputDir: detectedOutputDir,
                projectType,
                carFilePath,
                carRootCid: carResult.rootCid,
            });

            return {
                buildDir,
                outputDir: detectedOutputDir,
                logs,
                carFilePath,
                carRootCid: carResult.rootCid,
            };
        } catch (error) {
            logs += `\n❌ Error: ${(error as Error).message}\n`;
            logger.error(`Build failed for deployment ${deploymentId}:`, error);
            throw new Error(logs);
        }
    }

    private async detectOutputDir(buildDir: string): Promise<string> {
        const possibleDirs = [
            'out', // Next.js static export
            'dist', // Vite, Parcel
            'build', // CRA, Gatsby
            '.next', // Next.js
            'public', // Some static sites
        ];

        logger.debug('Detecting output directory', { buildDir, possibleDirs });

        for (const dir of possibleDirs) {
            const fullPath = path.join(buildDir, dir);
            try {
                const stats = await fs.stat(fullPath);
                if (stats.isDirectory()) {
                    logger.debug('Output directory detected', { buildDir, detectedDir: dir, fullPath });
                    return fullPath;
                }
            } catch {
                continue;
            }
        }

        logger.error('Could not detect build output directory', {
            buildDir,
            checkedDirs: possibleDirs,
        });

        throw new Error(
            'Could not detect build output directory. Please ensure your project has a build script that outputs to: out, dist, build, or .next'
        );
    }

    async getOutputPath(buildDir: string): Promise<string> {
        const metadataPath = path.join(buildDir, OUTPUT_METADATA_FILENAME);

        try {
            const relativePath = (await fs.readFile(metadataPath, 'utf-8')).trim();
            if (relativePath) {
                const resolvedPath = path.resolve(buildDir, relativePath);
                if (resolvedPath.startsWith(buildDir)) {
                    await fs.access(resolvedPath);
                    return resolvedPath;
                }
            }
        } catch {
            // ignore missing metadata file
        }

        const staticExport = path.join(buildDir, '__static_export__');
        try {
            const stats = await fs.stat(staticExport);
            if (stats.isDirectory()) {
                return staticExport;
            }
        } catch {
            // ignore
        }

        return this.detectOutputDir(buildDir);
    }

    cancelBuild(deploymentId: string): boolean {
        const child = this.activeProcesses.get(deploymentId);
        if (child) {
            logger.info('Cancelling build process', { deploymentId });
            child.kill('SIGTERM');
            this.activeProcesses.delete(deploymentId);
            logger.info('Build process cancelled', { deploymentId });
            return true;
        }
        logger.debug('No active build process to cancel', { deploymentId });
        return false;
    }

    private runCommand(command: string, deploymentId: string, options: ExecOptions = {}) {
        return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
            const execOptions: ExecOptions = {
                ...options,
                maxBuffer: options.maxBuffer ?? 10 * 1024 * 1024,
                timeout: options.timeout ?? 15 * 60 * 1000,
            };

            logger.debug('Executing command', {
                deploymentId,
                command: command.replace(/https:\/\/[^@]+@/, 'https://***@'), // Hide token in logs
                cwd: options.cwd,
                timeout: execOptions.timeout,
            });

            const startTime = Date.now();
            const child = exec(command, execOptions, (error, stdout, stderr) => {
                const duration = Date.now() - startTime;
                if (this.activeProcesses.get(deploymentId) === child) {
                    this.activeProcesses.delete(deploymentId);
                }
                if (error) {
                    const message = `${typeof stdout === 'string' ? stdout : stdout.toString()}${typeof stderr === 'string' ? stderr : stderr.toString()
                        }`.trim();
                    logger.error('Command execution failed', {
                        deploymentId,
                        command: command.replace(/https:\/\/[^@]+@/, 'https://***@'),
                        error: error.message,
                        duration: `${duration}ms`,
                    });
                    reject(new Error(message || error.message));
                    return;
                }
                logger.debug('Command executed successfully', {
                    deploymentId,
                    command: command.replace(/https:\/\/[^@]+@/, 'https://***@'),
                    duration: `${duration}ms`,
                });
                resolve({
                    stdout: typeof stdout === 'string' ? stdout : stdout.toString(),
                    stderr: typeof stderr === 'string' ? stderr : stderr.toString(),
                });
            });

            this.activeProcesses.set(deploymentId, child);
        });
    }

    private async prepareStaticOutput(buildDir: string): Promise<string> {
        const exportDir = path.join(buildDir, '__static_export__');
        await fs.rm(exportDir, { recursive: true, force: true }).catch(() => undefined);
        await fs.mkdir(exportDir, { recursive: true });

        const entries = await fs.readdir(buildDir);
        const ignoreEntries = new Set([
            '.git',
            '.github',
            '.gitignore',
            '.gitmodules',
            'node_modules',
            '__static_export__',
        ]);

        await Promise.all(
            entries.map(async (entry) => {
                if (ignoreEntries.has(entry)) {
                    return;
                }
                const source = path.join(buildDir, entry);
                const destination = path.join(exportDir, entry);
                await fs.cp(source, destination, { recursive: true });
            })
        );

        logger.info(`Prepared static export at ${exportDir}`);
        return exportDir;
    }

    private startCleanupTimer() {
        if (this.cleanupTimer) {
            return;
        }
        this.cleanupTimer = setInterval(() => {
            this.cleanupExpiredBuilds().catch((error) => {
                logger.warn('Failed to cleanup expired build artifacts:', error);
            });
        }, this.CLEANUP_INTERVAL_MS);
        if (this.cleanupTimer.unref) {
            this.cleanupTimer.unref();
        }
    }

    private async cleanupExpiredBuilds() {
        logger.debug('Starting cleanup of expired build artifacts', { buildRoot: this.BUILD_ROOT });
        let entries: string[] = [];
        try {
            entries = await fs.readdir(this.BUILD_ROOT);
        } catch {
            logger.warn('Could not read build root directory for cleanup', { buildRoot: this.BUILD_ROOT });
            return;
        }

        const now = Date.now();
        let deletedCount = 0;
        await Promise.all(
            entries.map(async (entry) => {
                const fullPath = path.join(this.BUILD_ROOT, entry);
                try {
                    const stats = await fs.stat(fullPath);
                    if (!stats.isDirectory()) {
                        return;
                    }
                    const age = now - stats.mtimeMs;
                    if (age > this.ARTIFACT_TTL_MS) {
                        await fs.rm(fullPath, { recursive: true, force: true });
                        deletedCount++;
                        logger.info(`Deleted expired build directory`, {
                            path: fullPath,
                            age: `${Math.round(age / (1000 * 60 * 60))} hours`,
                        });
                    }
                } catch (error) {
                    logger.warn('Error during cleanup of build directory', {
                        path: fullPath,
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
            })
        );

        if (deletedCount > 0) {
            logger.info('Cleanup completed', { deletedCount, totalEntries: entries.length });
        } else {
            logger.debug('Cleanup completed, no expired artifacts found', { totalEntries: entries.length });
        }
    }

    async cleanupDeploymentBuild(deploymentId: string): Promise<void> {
        const buildDir = getDeploymentBuildDir(deploymentId);
        try {
            await fs.access(buildDir);
            await fs.rm(buildDir, { recursive: true, force: true });
            logger.info('Cleaned up deployment build directory', { deploymentId, buildDir });
        } catch (error) {
            // Ignore if directory doesn't exist
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                logger.warn('Failed to cleanup deployment build directory', {
                    deploymentId,
                    buildDir,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
    }
}

export const buildService = new BuildService();

