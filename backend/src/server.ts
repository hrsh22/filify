import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import { Pool } from 'pg';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { logger } from './utils/logger';
import authRoutes from './routes/auth.routes';
import projectsRoutes from './routes/projects.routes';
import repositoriesRoutes from './routes/repositories.routes';
import deploymentsRoutes from './routes/deployments.routes';
import webhooksRoutes from './routes/webhooks.routes';
import ensRoutes from './routes/ens.routes';
import githubRoutes from './routes/github.routes';
import { cancelStaleDeployments } from './services/startup.service';

const app = express();
const PgStore = pgSession(session);

const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const backendUrl = new URL(env.BACKEND_URL);
const frontendUrl = new URL(env.FRONTEND_URL);
const sameOrigin = backendUrl.origin === frontendUrl.origin;
const cookieSecure = backendUrl.protocol === 'https:';
const cookieSameSite = !sameOrigin && cookieSecure ? 'none' : 'lax';

app.set('trust proxy', true);

app.use(helmet());
app.use(
    cors({
        origin: env.FRONTEND_URL,
        credentials: true,
        exposedHeaders: ['x-root-cid', 'x-build-output'],
    })
);

app.use(requestLogger);

app.use('/api/webhooks', webhooksRoutes);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
    session({
        store: new PgStore({
            pool,
            tableName: 'session',
            createTableIfMissing: true,
        }),
        secret: env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: cookieSecure,
            maxAge: 7 * 24 * 60 * 60 * 1000,
            sameSite: cookieSameSite,
        },
    })
);

app.use('/api/auth', authRoutes);
app.use('/api/github', githubRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/repositories', repositoriesRoutes);
app.use('/api/deployments', deploymentsRoutes);
app.use('/api/ens', ensRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

const PORT = env.PORT || 3000;

app.listen(PORT, () => {
    logger.info('Server starting', {
        port: PORT,
        environment: env.NODE_ENV,
        frontendUrl: env.FRONTEND_URL,
        backendUrl: env.BACKEND_URL,
    });
    logger.info(`Environment: ${env.NODE_ENV}`);
    logger.info(`Frontend URL: ${env.FRONTEND_URL}`);
    logger.info(`Backend URL: ${env.BACKEND_URL}`);

    cancelStaleDeployments().then((count) => {
        if (count > 0) {
            logger.info(`Cancelled ${count} stale deployment(s) from previous session`);
        }
    });
});
