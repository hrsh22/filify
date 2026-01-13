import fs from 'fs/promises';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { loadFilecoinPinModules } from '../utils/esm-loader';

export interface FilecoinUploadResult {
    rootCid: string;
    pieceCid?: string;
    transactionHash?: string;
    providerId?: number;
    dataSetId?: number;
}

export interface UploadProgress {
    status: 'initializing' | 'checking-readiness' | 'uploading' | 'confirming' | 'completed' | 'failed';
    progress: number;
    message?: string;
    error?: string;
}

type ProgressCallback = (progress: UploadProgress) => void;

// Singleton synapse instance
let synapsePromise: Promise<any> | null = null;

/**
 * Get or create the Synapse client singleton.
 */
async function getSynapseClient() {
    if (!synapsePromise) {
        const modules = await loadFilecoinPinModules();

        const uploadLogger = modules.pino({
            level: 'debug',
        });

        const config = {
            privateKey: env.FILECOIN_PRIVATE_KEY,
            rpcUrl: env.FILECOIN_RPC_URL,
            warmStorageAddress: env.WARM_STORAGE_ADDRESS,
        };

        logger.info('Initializing Synapse client for Filecoin uploads');
        synapsePromise = modules.initializeSynapse(config, uploadLogger);
    }

    return synapsePromise;
}

/**
 * Create a StorageContext, optionally reusing an existing dataset.
 * Selects a random approved provider for redundancy.
 */
async function createStorageContext(
    synapse: any,
    options: { providerId?: number; dataSetId?: number } = {}
) {
    const modules = await loadFilecoinPinModules();

    const warmStorage = synapse.storage._warmStorageService;
    if (!warmStorage) {
        throw new Error('WarmStorageService not available on Synapse instance');
    }

    const registryAddress = warmStorage.getServiceProviderRegistryAddress();
    const spRegistry = new modules.SPRegistryService(synapse.getProvider(), registryAddress);

    let providerInfo = null;

    if (options.providerId != null) {
        providerInfo = await spRegistry.getProvider(options.providerId);
    } else {
        const approvedProviderIds = await warmStorage.getApprovedProviderIds();
        if (approvedProviderIds.length === 0) {
            throw new Error('No approved storage providers available for upload');
        }
        const randomProviderId = approvedProviderIds[Math.floor(Math.random() * approvedProviderIds.length)];
        providerInfo = await spRegistry.getProvider(randomProviderId);
    }

    if (providerInfo == null) {
        throw new Error('Unable to resolve an approved storage provider');
    }

    const dataSetId = options.dataSetId ?? env.FILECOIN_DATASET_ID;
    const withCDN = env.FILECOIN_CDN_ENABLED;

    logger.info('Creating storage context', {
        dataSetId,
        envDataSetId: env.FILECOIN_DATASET_ID,
        withCDN,
        providerId: providerInfo.id,
    });

    const metadata = withCDN
        ? { ...modules.DEFAULT_DATA_SET_METADATA, [modules.METADATA_KEYS.WITH_CDN]: '' }
        : { ...modules.DEFAULT_DATA_SET_METADATA };

    const storageContext = new modules.StorageContext(
        synapse,
        warmStorage,
        providerInfo,
        dataSetId,
        { ...modules.DEFAULT_STORAGE_CONTEXT_CONFIG, metadata },
        metadata
    );

    return { storage: storageContext, providerInfo, dataSetId, withCDN };
}

class FilecoinUploadService {
    /**
     * Upload a CAR file to Filecoin.
     *
     * @param carFilePath - Path to the CAR file
     * @param rootCidString - The root CID of the CAR file
     * @param deploymentId - Deployment ID for logging
     * @param onProgress - Optional callback for progress updates
     */
    async uploadCar(
        carFilePath: string,
        rootCidString: string,
        deploymentId: string,
        onProgress?: ProgressCallback
    ): Promise<FilecoinUploadResult> {
        const updateProgress = (update: UploadProgress) => {
            logger.debug('Upload progress', { deploymentId, ...update });
            onProgress?.(update);
        };

        try {
            updateProgress({ status: 'initializing', progress: 0, message: 'Initializing Filecoin client' });

            // Load ESM modules dynamically
            const modules = await loadFilecoinPinModules();

            // Read CAR file
            logger.info('Reading CAR file for upload', { deploymentId, carFilePath });
            const carBuffer = await fs.readFile(carFilePath);
            const carBytes = new Uint8Array(carBuffer);

            // Initialize Synapse
            const synapse = await getSynapseClient();
            updateProgress({ status: 'initializing', progress: 20, message: 'Synapse client ready' });

            // Check upload readiness
            updateProgress({ status: 'checking-readiness', progress: 30, message: 'Checking wallet readiness' });
            logger.info('Checking upload readiness', { deploymentId, carSize: carBytes.length });

            const readinessCheck = await modules.checkUploadReadiness({
                synapse,
                fileSize: carBytes.length,
                autoConfigureAllowances: true,
            });

            if (readinessCheck.status === 'blocked') {
                const serializeWithBigInt = (obj: unknown) => JSON.stringify(obj, (_, v) => typeof v === 'bigint' ? v.toString() : v);
                logger.error('Upload readiness blocked', { 
                    deploymentId, 
                    status: readinessCheck.status,
                    readinessCheck: serializeWithBigInt(readinessCheck),
                });
                const suggestions = (readinessCheck as any).suggestions || [];
                const capacitySuggestions = (readinessCheck as any).capacity?.suggestions || [];
                const allSuggestions = [...suggestions, ...capacitySuggestions];
                const reasons = allSuggestions.length > 0 ? allSuggestions.join(', ') : 'Unknown blocking reason';
                throw new Error(`Upload blocked: ${reasons}`);
            }

            logger.info('Upload readiness check passed', { deploymentId, status: readinessCheck.status });
            updateProgress({ status: 'checking-readiness', progress: 50, message: 'Readiness check passed' });

            const { storage: storageContext, providerInfo, dataSetId, withCDN } = await createStorageContext(synapse);
            logger.info('Storage context created', {
                deploymentId,
                providerId: providerInfo.id,
                providerName: providerInfo.name,
                dataSetId: dataSetId ?? 'new',
                withCDN,
            });

            updateProgress({ status: 'uploading', progress: 60, message: 'Starting upload to Filecoin SP' });

            // Parse the root CID
            const rootCid = modules.CID.parse(rootCidString);

            // Track upload results
            let result: FilecoinUploadResult = {
                rootCid: rootCidString,
                providerId: providerInfo.id,
            };

            // Create upload logger
            const uploadLogger = modules.pino({ level: 'debug' });

            // Execute upload
            const synapseService = {
                storage: storageContext,
                providerInfo,
                synapse,
            };

            await modules.executeUpload(synapseService, carBytes, rootCid, {
                logger: uploadLogger,
                contextId: `upload-${deploymentId}`,
                onProgress: (event: any) => {
                    switch (event.type) {
                        case 'onUploadComplete':
                            result.pieceCid = event.data.pieceCid.toString();
                            logger.info('CAR upload completed', {
                                deploymentId,
                                pieceCid: result.pieceCid,
                            });
                            updateProgress({ status: 'uploading', progress: 80, message: 'Upload complete' });
                            break;

                        case 'onPieceAdded':
                            result.transactionHash = event.data.txHash;
                            logger.info('Piece added transaction submitted', {
                                deploymentId,
                                txHash: result.transactionHash,
                            });
                            updateProgress({ status: 'confirming', progress: 90, message: 'Transaction submitted' });
                            break;

                        case 'onPieceConfirmed':
                            result.dataSetId = storageContext.dataSetId;
                            logger.info('Piece confirmed on-chain', {
                                deploymentId,
                                dataSetId: result.dataSetId,
                            });
                            updateProgress({ status: 'completed', progress: 100, message: 'Upload confirmed' });
                            break;

                        case 'ipniProviderResults.failed':
                            logger.warn('IPNI announcement failed (non-blocking)', {
                                deploymentId,
                                error: event.data.error?.message,
                            });
                            break;

                        case 'ipniProviderResults.complete':
                            logger.info('IPNI announcement complete', { deploymentId });
                            break;
                    }
                },
            });

            logger.info('Filecoin upload completed successfully', {
                deploymentId,
                ...result,
            });

            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Upload failed';
            logger.error('Filecoin upload failed', {
                deploymentId,
                error: errorMessage,
            });
            updateProgress({
                status: 'failed',
                progress: 0,
                error: errorMessage,
            });
            throw error;
        }
    }
}

export const filecoinUploadService = new FilecoinUploadService();
