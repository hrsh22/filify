import { exec, type ChildProcess, type ExecOptions } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { encryptionService } from './encryption.service';
import { logger } from '../utils/logger';
import { getBuildsRoot, getDeploymentBuildDir } from '../utils/paths';

interface BuildResult {
    buildDir: string;
    outputDir: string;
    logs: string;
}

interface BuildOptions {
    buildCommand?: string | null;
    outputDir?: string | null;
    reuseDir?: string | null;
    reuseLabel?: string | null;
}

const OUTPUT_METADATA_FILENAME = '.output-dir';

class BuildService {
    private readonly BUILD_ROOT = getBuildsRoot();
    private readonly activeProcesses = new Map<string, ChildProcess>();

    async cloneAndBuild(
        repoUrl: string,
        branch: string,
        encryptedToken: string,
        deploymentId: string,
        options: BuildOptions = {}
    ): Promise<BuildResult> {
        const buildDir = getDeploymentBuildDir(deploymentId);
        const { buildCommand, outputDir, reuseDir, reuseLabel } = options;
        let logs = '';

        try {
            // Ensure build root exists
            await fs.mkdir(this.BUILD_ROOT, { recursive: true });

            if (reuseDir) {
                logs += `Reusing previous workspace${reuseLabel ? ` from deployment ${reuseLabel}` : ''}\n`;
                logger.info(`Reusing workspace from ${reuseDir} for deployment ${deploymentId}`);
                await fs.rm(buildDir, { recursive: true, force: true }).catch(() => undefined);
                await fs.cp(reuseDir, buildDir, { recursive: true });
                logs += `✓ Copied previous workspace\n\n`;
            } else {
                // Decrypt GitHub token
                const token = encryptionService.decrypt(encryptedToken);

                // Clone repository with authentication
                logs += `Cloning repository: ${repoUrl} (branch: ${branch})\n`;
                const authUrl = repoUrl.replace('https://', `https://${token}@`);

                await fs.rm(buildDir, { recursive: true, force: true }).catch(() => undefined);
                await this.runCommand(`git clone --single-branch --branch ${branch} ${authUrl} ${buildDir}`, deploymentId);
                logs += `✓ Repository cloned successfully\n\n`;
            }

            // Determine project type
            logs += `Checking project structure...\n`;
            const packageJsonPath = path.join(buildDir, 'package.json');
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
                const hasNextDep =
                    typeof packageJson.dependencies?.next === 'string' ||
                    typeof packageJson.devDependencies?.next === 'string';
                if (hasNextDep) {
                    projectType = 'nextjs';
                    logs += `Detected Next.js project\n`;
                    // Ensure a static export config exists
                    const nextConfigPath = path.join(buildDir, 'next.config.js');
                    const nextConfigMjsPath = path.join(buildDir, 'next.config.mjs');
                    const nextConfigTsPath = path.join(buildDir, 'next.config.ts');
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
            }

            let detectedOutputDir: string;
            if (projectType === 'static') {
                detectedOutputDir = await this.prepareStaticOutput(buildDir);
            } else {
                // Install dependencies
                logs += `Installing dependencies...\n`;
                const installResult = await this.runCommand('npm install', deploymentId, {
                    cwd: buildDir,
                });
                logs += installResult.stdout + installResult.stderr;
                logs += `✓ Dependencies installed\n\n`;

                // Build project
                logs += `Building project...\n`;
                const buildCmd = buildCommand ?? 'npm run build';
                const buildResult = await this.runCommand(buildCmd, deploymentId, {
                    cwd: buildDir,
                    env: {
                        ...process.env,
                        NODE_ENV: 'production',
                    },
                });
                logs += buildResult.stdout + buildResult.stderr;
                logs += `✓ Build completed\n\n`;

                detectedOutputDir = outputDir
                    ? path.join(buildDir, outputDir)
                    : await this.detectOutputDir(buildDir);
            }
            // Record detected output directory for later retrieval
            const relativeOutputDir = path.relative(buildDir, detectedOutputDir) || '.';
            await fs.writeFile(path.join(buildDir, OUTPUT_METADATA_FILENAME), relativeOutputDir, 'utf-8');

            logs += `✓ Output directory detected: ${path.basename(detectedOutputDir)}\n`;

            return { buildDir, outputDir: detectedOutputDir, logs };
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

        for (const dir of possibleDirs) {
            const fullPath = path.join(buildDir, dir);
            try {
                const stats = await fs.stat(fullPath);
                if (stats.isDirectory()) {
                    return fullPath;
                }
            } catch {
                continue;
            }
        }

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
            child.kill('SIGTERM');
            this.activeProcesses.delete(deploymentId);
            return true;
        }
        return false;
    }

    private runCommand(command: string, deploymentId: string, options: ExecOptions = {}) {
        return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
            const execOptions: ExecOptions = {
                ...options,
                maxBuffer: options.maxBuffer ?? 10 * 1024 * 1024,
            };

            const child = exec(command, execOptions, (error, stdout, stderr) => {
                if (this.activeProcesses.get(deploymentId) === child) {
                    this.activeProcesses.delete(deploymentId);
                }
                if (error) {
                    const message = `${typeof stdout === 'string' ? stdout : stdout.toString()}${typeof stderr === 'string' ? stderr : stderr.toString()
                        }`.trim();
                    reject(new Error(message || error.message));
                    return;
                }
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
}

export const buildService = new BuildService();

