import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type Network = 'mainnet' | 'sepolia';

interface NetworkContextValue {
    network: Network;
    setNetwork: (network: Network) => void;
    chainId: number;
    networkName: string;
}

const NETWORK_CONFIG = {
    mainnet: {
        chainId: 1,
        name: 'Ethereum Mainnet',
    },
    sepolia: {
        chainId: 11155111,
        name: 'Sepolia Testnet',
    },
} as const;

const STORAGE_KEY = 'filify_network';

const NetworkContext = createContext<NetworkContextValue | null>(null);

export function NetworkProvider({ children }: { children: ReactNode }) {
    const [network, setNetworkState] = useState<Network>(() => {
        if (typeof window === 'undefined') return 'mainnet';
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored === 'sepolia' ? 'sepolia' : 'mainnet';
    });

    const setNetwork = (newNetwork: Network) => {
        setNetworkState(newNetwork);
        localStorage.setItem(STORAGE_KEY, newNetwork);
    };

    // Sync with localStorage changes from other tabs
    useEffect(() => {
        const handleStorage = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY && e.newValue) {
                setNetworkState(e.newValue === 'sepolia' ? 'sepolia' : 'mainnet');
            }
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    const value: NetworkContextValue = {
        network,
        setNetwork,
        chainId: NETWORK_CONFIG[network].chainId,
        networkName: NETWORK_CONFIG[network].name,
    };

    return (
        <NetworkContext.Provider value={value}>
            {children}
        </NetworkContext.Provider>
    );
}

export function useNetwork() {
    const ctx = useContext(NetworkContext);
    if (!ctx) {
        throw new Error('useNetwork must be used within a NetworkProvider');
    }
    return ctx;
}
