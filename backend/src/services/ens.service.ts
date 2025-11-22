import { ethers } from 'ethers';
import contentHash from 'content-hash';
import { logger } from '../utils/logger';

type CidModule = typeof import('multiformats/cid');
type Base58Module = typeof import('multiformats/bases/base58');

let cidModulePromise: Promise<CidModule> | null = null;
let base58ModulePromise: Promise<Base58Module> | null = null;

async function loadCidModule(): Promise<CidModule> {
    if (!cidModulePromise) {
        cidModulePromise = import('multiformats/cid');
    }
    return cidModulePromise;
}

async function loadBase58Module(): Promise<Base58Module> {
    if (!base58ModulePromise) {
        base58ModulePromise = import('multiformats/bases/base58');
    }
    return base58ModulePromise;
}

interface PreparedENSTransaction {
    resolverAddress: string;
    data: string;
    chainId: number;
    rpcUrl: string;
    encodedContenthash: string;
    normalizedCid: string;
    gasEstimate?: string | null;
}

interface ENSConfirmationResult {
    txHash: string;
    blockNumber: number;
    gasUsed: string | null;
    verified: boolean;
}

class ENSService {
    /**
     * Normalize IPFS CID (CIDv0 or CIDv1) into a base58btc string suitable for ENS contenthash encoding.
     * References:
     * - https://docs.ens.domains/web/quickstart/
     * - https://github.com/FIL-Builders/filecoin-pin-ens-demo
     */
    private async normalizeIpfsCid(ipfsCid: string): Promise<string> {
        try {
            const [{ CID }, { base58btc }] = await Promise.all([loadCidModule(), loadBase58Module()]);
            const parsed = CID.parse(ipfsCid);

            if (parsed.version === 0) {
                return parsed.toString();
            }

            if (parsed.code === 0x70 && parsed.multihash.code === 0x12) {
                return parsed.toV0().toString();
            }

            return parsed.toString(base58btc.encoder);
        } catch (error) {
            throw new Error(
                `Invalid IPFS CID provided for ENS update: ${(error as Error).message}. Ensure the CID is a valid CIDv0 or CIDv1 value.`
            );
        }
    }
    async prepareContenthashTx(
        ensName: string,
        ownerAddress: string,
        ipfsCid: string,
        rpcUrl: string
    ): Promise<PreparedENSTransaction> {
        try {
            const normalizedOwner = ethers.getAddress(ownerAddress);
            const normalizedCid = await this.normalizeIpfsCid(ipfsCid);
            const provider = new ethers.JsonRpcProvider(rpcUrl);

            logger.info(`Preparing ENS contenthash transaction for ${ensName}`);
            logger.info(`Owner address: ${normalizedOwner}`);
            logger.info(`Normalized IPFS CID (base58btc): ${normalizedCid}`);

            const resolver = await provider.getResolver(ensName);

            if (!resolver?.address) {
                throw new Error(
                    `ENS resolver not found for ${ensName}. Ensure the domain is registered and configured.`
                );
            }

            const node = ethers.namehash(ensName);
            const encoded = `0x${contentHash.encode('ipfs-ns', normalizedCid)}`;
            const resolverInterface = new ethers.Interface([
                'function setContenthash(bytes32 node, bytes calldata hash) external',
            ]);
            const data = resolverInterface.encodeFunctionData('setContenthash', [node, encoded]);

            let gasEstimate: string | null = null;
            try {
                const estimate = await provider.estimateGas({
                    to: resolver.address,
                    from: normalizedOwner,
                    data,
                });
                gasEstimate = estimate.toString();
            } catch (gasError) {
                logger.warn('Failed to estimate ENS gas usage', {
                    ensName,
                    error: gasError instanceof Error ? gasError.message : String(gasError),
                });
            }

            const network = await provider.getNetwork();

            logger.info(`ENS transaction prepared`, {
                ensName,
                resolver: resolver.address,
                chainId: Number(network.chainId),
            });

            return {
                resolverAddress: resolver.address,
                data,
                chainId: Number(network.chainId),
                rpcUrl,
                encodedContenthash: encoded,
                normalizedCid,
                gasEstimate,
            };
        } catch (error) {
            logger.error('ENS transaction preparation failed:', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                ensName,
                ipfsCid,
            });
            throw new Error(`Failed to prepare ENS transaction: ${(error as Error).message}`);
        }
    }

    async waitForTransaction(params: {
        ensName: string;
        txHash: string;
        expectedCid: string;
        rpcUrl: string;
    }): Promise<ENSConfirmationResult> {
        const { ensName, txHash, expectedCid, rpcUrl } = params;
        try {
            logger.info(`Waiting for ENS transaction ${txHash}`, { ensName });
            const provider = new ethers.JsonRpcProvider(rpcUrl);
            const receipt = await provider.waitForTransaction(txHash);

            if (!receipt) {
                throw new Error('Transaction receipt not found');
            }

            const normalizedCid = await this.normalizeIpfsCid(expectedCid);
            const verified = await this.verifyContentHash(ensName, normalizedCid, rpcUrl);

            logger.info(`ENS transaction confirmed`, {
                ensName,
                txHash,
                blockNumber: receipt.blockNumber,
                verified,
            });

            return {
                txHash: receipt.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed ? receipt.gasUsed.toString() : null,
                verified,
            };
        } catch (error) {
            logger.error('ENS confirmation failed:', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                ensName,
                txHash,
            });
            throw new Error(`Failed to confirm ENS transaction: ${(error as Error).message}`);
        }
    }

    async verifyContentHash(ensName: string, expectedCid: string, rpcUrl: string): Promise<boolean> {
        logger.debug('Verifying ENS contenthash', { ensName, expectedCid });
        try {
            const provider = new ethers.JsonRpcProvider(rpcUrl);
            const resolver = await provider.getResolver(ensName);

            if (!resolver) {
                logger.warn(`Resolver missing while verifying contenthash for ${ensName}`);
                return false;
            }

            const contenthash = await resolver.getContentHash();
            if (!contenthash || contenthash === '0x') {
                logger.warn(`Resolver returned empty contenthash for ${ensName}`);
                return false;
            }

            let decoded: string;
            try {
                decoded = contentHash.decode(contenthash);
            } catch (decodeError) {
                logger.warn('Contenthash decode failed during verification', {
                    ens: ensName,
                    contenthash,
                    error: (decodeError as Error).message,
                });
                return false;
            }

            const matches = decoded === expectedCid;
            logger.debug('ENS verification result', { ensName, matches, decoded, expectedCid });
            return matches;
        } catch (error) {
            logger.warn('ENS verification failed:', {
                error: error instanceof Error ? error.message : String(error),
                ensName,
                expectedCid,
            });
            return false;
        }
    }
}

export const ensService = new ENSService();
