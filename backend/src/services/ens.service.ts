import { ethers } from 'ethers';
import contentHash from 'content-hash';
import { logger } from '../utils/logger';
import { encryptionService } from './encryption.service';

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

interface ENSUpdateResult {
    txHash: string;
    blockNumber: number;
    gasUsed: string;
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
    async updateContentHash(
        ensName: string,
        encryptedPrivateKey: string,
        ipfsCid: string,
        rpcUrl: string
    ): Promise<ENSUpdateResult> {
        try {
            // Decrypt private key
            const privateKey = encryptionService.decrypt(encryptedPrivateKey);

            // Connect to provider
            const provider = new ethers.JsonRpcProvider(rpcUrl);
            const wallet = new ethers.Wallet(privateKey, provider);

            logger.info(`Updating ENS contenthash for ${ensName}`);
            logger.info(`Wallet address: ${wallet.address}`);
            logger.info(`Original IPFS CID: ${ipfsCid}`);

            const normalizedCid = await this.normalizeIpfsCid(ipfsCid);
            logger.info(`Normalized IPFS CID (base58btc): ${normalizedCid}`);

            // Encode IPFS CID to contenthash format (EIP-1577)
            const encoded = `0x${contentHash.encode('ipfs-ns', normalizedCid)}`;
            logger.info(`Encoded contenthash: ${encoded}`);

            // Get ENS registry and resolver
            const resolver = await provider.getResolver(ensName);

            if (!resolver) {
                throw new Error(
                    `ENS resolver not found for ${ensName}. Ensure the domain is registered and configured.`
                );
            }

            // Get the namehash
            const node = ethers.namehash(ensName);

            // Create resolver contract interface
            const resolverInterface = new ethers.Interface([
                'function setContenthash(bytes32 node, bytes calldata hash) external',
            ]);

            // Encode the transaction data
            const data = resolverInterface.encodeFunctionData('setContenthash', [node, encoded]);

            const resolverAddress = resolver.address;
            if (!resolverAddress) {
                throw new Error('Resolver address not found in provider response');
            }

            // Send transaction to the resolver contract (NOT the name's resolved address)
            const tx = await wallet.sendTransaction({
                to: resolverAddress,
                data,
            });

            logger.info(`Transaction sent: ${tx.hash}`);
            logger.info(`Waiting for confirmation...`);

            // Wait for transaction confirmation
            const receipt = await tx.wait();

            if (!receipt) {
                throw new Error('Transaction receipt not found');
            }

            logger.info(`✓ ENS contenthash updated successfully`);
            logger.info(`Block number: ${receipt.blockNumber}`);
            logger.info(`Gas used: ${receipt.gasUsed.toString()}`);

            try {
                const verified = await this.verifyContentHash(ensName, normalizedCid, rpcUrl);
                logger.info(`Post-update ENS verification ${verified ? 'succeeded' : 'failed'}`);
            } catch (verificationError) {
                logger.warn(
                    `ENS verification skipped due to error: ${(verificationError as Error).message}`
                );
            }

            return {
                txHash: receipt.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString(),
            };
        } catch (error) {
            logger.error('ENS update failed:', error);
            throw new Error(`Failed to update ENS contenthash: ${(error as Error).message}`);
        }
    }

    async verifyContentHash(ensName: string, expectedCid: string, rpcUrl: string): Promise<boolean> {
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

            return decoded === expectedCid;
        } catch (error) {
            logger.warn('ENS verification failed:', error);
            return false;
        }
    }
}

export const ensService = new ENSService();
