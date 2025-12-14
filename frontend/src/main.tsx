import { StrictMode } from "react";
import { HashRouter } from "react-router-dom";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import "./index.css";
import App from "./app";
import { AuthProvider } from "./context/auth-context";
import { ToastProvider } from "./context/toast-context";
import { ErrorBoundary } from "./components/error-boundary";
import { WalletProvider } from "./context/wallet-provider";
import { NetworkProvider } from "./context/network-context";

const root = document.getElementById("root");

if (!root) {
    throw new Error("Root element not found");
}

createRoot(root).render(
    <StrictMode>
        <HashRouter>
            <NetworkProvider>
                <WalletProvider>
                    <AuthProvider>
                        <ToastProvider>
                            <ErrorBoundary>
                                <App />
                            </ErrorBoundary>
                            <Toaster position="bottom-right" richColors />
                        </ToastProvider>
                    </AuthProvider>
                </WalletProvider>
            </NetworkProvider>
        </HashRouter>
    </StrictMode>
);
