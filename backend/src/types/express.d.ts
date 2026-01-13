declare global {
  namespace Express {
    interface User {
      walletAddress: string;
      ensName: string | null;
      createdAt: Date;
      updatedAt: Date;
    }

    interface Request {
      userId?: string;
    }
  }
}

declare module 'express-session' {
  interface SessionData {
    nonce?: string;
    siwe?: {
      address: string;
      chainId: number;
    };
  }
}

export {};
