import { env } from './env';

export const NETWORK_CONFIG = {
    mainnet: {
        chainId: 1,
        name: 'Ethereum Mainnet',
        rpcUrl: env.DEFAULT_ETHEREUM_RPC,
        ensSubgraphId: '5XqPmWe6gjyrJtFn9cLy237i4cWw2j9HcUJEXsP5qGtH',
        ensSubgraphUrl: 'https://gateway.thegraph.com/api/subgraphs/id/5XqPmWe6gjyrJtFn9cLy237i4cWw2j9HcUJEXsP5qGtH',
    },
    sepolia: {
        chainId: 11155111,
        name: 'Sepolia Testnet',
        rpcUrl: `https://eth-sepolia.g.alchemy.com/v2/${env.ALCHEMY_KEY}`,
        ensSubgraphId: 'G1SxZs317YUb9nQX3CC98hDyvxfMJNZH5pPRGpNrtvwN',
        ensSubgraphUrl: 'https://gateway.thegraph.com/api/subgraphs/id/G1SxZs317YUb9nQX3CC98hDyvxfMJNZH5pPRGpNrtvwN',
    },
} as const;

export type NetworkType = keyof typeof NETWORK_CONFIG;

export function getNetworkConfig(network: NetworkType) {
    return NETWORK_CONFIG[network];
}

export function isValidNetwork(network: string): network is NetworkType {
    return network === 'mainnet' || network === 'sepolia';
}
