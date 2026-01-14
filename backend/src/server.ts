import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import SQLiteStore from 'connect-sqlite3';
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
import fs from 'fs';
import path from 'path';

const app = express();
const SessionStore = SQLiteStore(session) as any;

const backendUrl = new URL(env.BACKEND_URL);
const frontendUrl = new URL(env.FRONTEND_URL);
const sameOrigin = backendUrl.origin === frontendUrl.origin;
const cookieSecure = backendUrl.protocol === 'https:';
const cookieSameSite = !sameOrigin && cookieSecure ? 'none' : 'lax';

app.set('trust proxy', true);

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

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

const isTurso = env.DATABASE_URL.startsWith('libsql://') || env.DATABASE_URL.startsWith('https://');
const sessionDbPath = isTurso ? './data/sessions.db' : env.DATABASE_URL.replace('sqlite:', '');
const sessionDbDir = path.dirname(sessionDbPath);
const sessionDbFile = path.basename(sessionDbPath);

if (!fs.existsSync(sessionDbDir)) {
    fs.mkdirSync(sessionDbDir, { recursive: true });
}

app.use(
    session({
        store: new SessionStore({
            db: sessionDbFile,
            dir: sessionDbDir || './data',
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
