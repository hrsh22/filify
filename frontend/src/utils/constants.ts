// Wallet & Filecoin Configuration
export const REOWN_PROJECT_ID = 'acf9536ae2f5e07d7e38bbbd1bc80326';

if (!REOWN_PROJECT_ID) {
    throw new Error('REOWN_PROJECT_ID must be set in src/utils/constants.ts');
}

export const FILECOIN_PRIVATE_KEY = '0xdb559ca57e706a34a4c418b7abd6f244e3312556a552833d967097cc3b0e6f4d';

if (!FILECOIN_PRIVATE_KEY) {
    throw new Error('FILECOIN_PRIVATE_KEY must be set in src/utils/constants.ts');
}

// API Configuration
export const BACKEND_URL = 'https://filify-backend.hrsh22.me';
export const API_URL = `${BACKEND_URL}/api`;

// Ethereum/ENS Configuration
const ALCHEMY_KEY = '0INEHyBWJeRtdwKOIIkaOW4Jnh92W6gB';
export const DEFAULT_ETHEREUM_RPC = `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;
export const THEGRAPH_API_KEY = 'b3e67bd270eaad7940b2d37c6e7331a9';
