import { z } from 'zod';

export const createProjectSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(100),
        repoFullName: z.string().min(1),
        repoUrl: z.string().url(),
        repoBranch: z.string().optional().default('main'),
        installationId: z.string().min(1),
        network: z.enum(['mainnet', 'sepolia']).default('mainnet'),
        ensName: z.string().regex(/^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/, 'Invalid ENS name format').optional().nullable(),
        ensOwnerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address').optional().nullable(),
        ethereumRpcUrl: z.string().url().optional().nullable(),
        buildCommand: z.string().optional(),
        outputDir: z.string().optional(),
        frontendDir: z.string().min(1).optional(),
        force: z.boolean().optional(),
    }).refine(
        (data) => {
            if (data.ensName && !data.ensOwnerAddress) return false;
            return true;
        },
        { message: 'ENS owner address is required when ENS name is provided' }
    ),
});

export const updateProjectSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(100).optional(),
        repoBranch: z.string().optional(),
        autoDeployBranch: z.string().optional(),
        network: z.enum(['mainnet', 'sepolia']).optional(),
        ensName: z.string().regex(/^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/).optional(),
        ensOwnerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
        ethereumRpcUrl: z.string().url().optional(),
        buildCommand: z.string().optional(),
        outputDir: z.string().optional(),
        frontendDir: z.string().min(1).optional(),
    }),
});

export const webhookToggleSchema = z.object({
    body: z.object({
        branch: z.string().optional(),
    }),
});

export const emptyBodySchema = z.object({
    body: z.object({}).optional(),
});

export const uploadFailureSchema = z.object({
    body: z.object({
        message: z.string().optional(),
    }),
});
export const createDeploymentSchema = z.object({
    body: z.object({
        projectId: z.string().min(1),
    }),
});

export const prepareENSSchema = z.object({
    body: z.object({
        ipfsCid: z.string().regex(/^bafy[a-z0-9]{52,}$/, 'Invalid IPFS CID format'),
    }),
});

export const confirmENSSchema = z.object({
    body: z.object({
        txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash'),
    }),
});

