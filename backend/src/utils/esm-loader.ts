/**
 * Dynamic ESM module loader for filecoin-pin
 * 
 * The filecoin-pin package is ESM-only, but we need to use it from CommonJS.
 * This module provides a dynamic import wrapper.
 */

// Cache for loaded modules
let modulesLoaded = false;
let cachedModules: any = {};

export async function loadFilecoinPinModules() {
    if (modulesLoaded) {
        return cachedModules;
    }

    // Dynamic imports work at runtime even in CommonJS
    const [synapseModule, uploadModule, synapseSdkModule, spRegistryModule, multiformatsModule, pinoModule] =
        await Promise.all([
            Function('return import("filecoin-pin/core/synapse")')(),
            Function('return import("filecoin-pin/core/upload")')(),
            Function('return import("@filoz/synapse-sdk")')(),
            Function('return import("@filoz/synapse-sdk/sp-registry")')(),
            Function('return import("multiformats/cid")')(),
            Function('return import("pino")')(),
        ]);

    cachedModules = {
        initializeSynapse: synapseModule.initializeSynapse,
        DEFAULT_DATA_SET_METADATA: synapseModule.DEFAULT_DATA_SET_METADATA,
        DEFAULT_STORAGE_CONTEXT_CONFIG: synapseModule.DEFAULT_STORAGE_CONTEXT_CONFIG,
        checkUploadReadiness: uploadModule.checkUploadReadiness,
        executeUpload: uploadModule.executeUpload,
        StorageContext: synapseSdkModule.StorageContext,
        SPRegistryService: spRegistryModule.SPRegistryService,
        CID: multiformatsModule.CID,
        pino: pinoModule.default ?? pinoModule,
    };

    modulesLoaded = true;
    return cachedModules;
}
