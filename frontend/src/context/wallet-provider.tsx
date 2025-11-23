import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { mainnet } from "@reown/appkit/networks";
import { createAppKit, modal } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { REOWN_PROJECT_ID } from "@/utils/constants";

const queryClient = new QueryClient();

const projectId = REOWN_PROJECT_ID;

const appUrl = typeof window === "undefined" ? "https://filify.app" : window.location.origin;

const metadata = {
    name: "Filify",
    description: "Deploy to Filecoin + ENS with dual wallet/GitHub auth",
    url: appUrl,
    icons: ["https://filify.app/icon.png"]
};

const networks = [mainnet] as [typeof mainnet];

const wagmiAdapter = new WagmiAdapter({
    networks,
    projectId: projectId!,
    ssr: false
});

if (!modal) {
    createAppKit({
        adapters: [wagmiAdapter],
        networks,
        projectId,
        metadata
    });
}

export function WalletProvider({ children }: { children: ReactNode }) {
    return (
        <QueryClientProvider client={queryClient}>
            <WagmiProvider config={wagmiAdapter.wagmiConfig}>{children}</WagmiProvider>
        </QueryClientProvider>
    );
}
