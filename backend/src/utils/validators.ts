import { z } from 'zod';

export const createProjectSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(100),
        repoName: z.string().min(1),
        repoUrl: z.string().url(),
        repoBranch: z.string().optional().default('main'),
        ensName: z.string().regex(/^[a-z0-9-]+\.eth$/, 'Invalid ENS name format'),
        ensPrivateKey: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid private key format'),
        ethereumRpcUrl: z.string().url(),
        buildCommand: z.string().optional(),
        outputDir: z.string().optional(),
    }),
});

export const updateProjectSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(100).optional(),
        repoBranch: z.string().optional(),
        ensName: z.string().regex(/^[a-z0-9-]+\.eth$/).optional(),
        ensPrivateKey: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
        ethereumRpcUrl: z.string().url().optional(),
        buildCommand: z.string().optional(),
        outputDir: z.string().optional(),
    }),
});

export const createDeploymentSchema = z.object({
    body: z.object({
        projectId: z.string().min(1),
        resumeFromPrevious: z.boolean().optional().default(false),
    }),
});

export const updateENSSchema = z.object({
    body: z.object({
        ipfsCid: z.string().regex(/^bafy[a-z0-9]{52,}$/, 'Invalid IPFS CID format'),
    }),
});

