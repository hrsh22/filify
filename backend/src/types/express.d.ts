import { User } from '../db/schema';

declare global {
  namespace Express {
    interface User {
      id: string;
      githubId: number;
      githubUsername: string;
      githubEmail: string | null;
      githubToken: string;
      avatarUrl: string | null;
      createdAt: Date;
      updatedAt: Date;
    }

    interface Request {
      userId?: string;
    }
  }
}




