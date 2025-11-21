import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { env } from './env';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { encryptionService } from '../services/encryption.service';
import { generateId } from '../utils/generateId';

passport.use(
  new GitHubStrategy(
    {
      clientID: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      callbackURL: `${env.BACKEND_URL}/api/auth/github/callback`,
      scope: ['user:email', 'repo'],
    },
    async (accessToken: string, refreshToken: string | undefined, profile: any, done: (error: any, user?: any) => void) => {
      try {
        // Check if user exists
        const existingUser = await db.query.users.findFirst({
          where: eq(users.githubId, profile.id),
        });

        const encryptedToken = encryptionService.encrypt(accessToken);

        if (existingUser) {
          // Update existing user
          const updated = await db
            .update(users)
            .set({
              githubToken: encryptedToken,
              githubUsername: profile.username || '',
              githubEmail: profile.emails?.[0]?.value || null,
              avatarUrl: profile.photos?.[0]?.value || null,
              updatedAt: new Date(),
            })
            .where(eq(users.id, existingUser.id))
            .returning();

          return done(null, updated[0]);
        } else {
          // Create new user
          const newUser = await db
            .insert(users)
            .values({
              id: generateId(),
              githubId: profile.id,
              githubUsername: profile.username || '',
              githubEmail: profile.emails?.[0]?.value || null,
              githubToken: encryptedToken,
              avatarUrl: profile.photos?.[0]?.value || null,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();

          return done(null, newUser[0]);
        }
      } catch (error) {
        return done(error as Error);
      }
    }
  )
);

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
    });
    done(null, user);
  } catch (error) {
    done(error);
  }
});

