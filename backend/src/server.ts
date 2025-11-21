import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import passport from 'passport';
import SQLiteStore from 'connect-sqlite3';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';
import authRoutes from './routes/auth.routes';
import projectsRoutes from './routes/projects.routes';
import repositoriesRoutes from './routes/repositories.routes';
import deploymentsRoutes from './routes/deployments.routes';
import './config/passport'; // Initialize passport strategies
import fs from 'fs';
import path from 'path';

const app = express();
const SessionStore = SQLiteStore(session) as any;

// Ensure data directory exists for sessions
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Security middleware
app.use(helmet());
app.use(
    cors({
        origin: env.FRONTEND_URL,
        credentials: true,
    })
);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
// Use the same database file as the main app (consolidated storage)
// connect-sqlite3 will create a 'sessions' table in the same database
const dbPath = env.DATABASE_URL.replace('sqlite:', '');
const dbDir = path.dirname(dbPath);
const dbFile = path.basename(dbPath);

app.use(
    session({
        store: new SessionStore({
            db: dbFile, // Use same filename as main DB
            dir: dbDir || './data', // Use same directory as main DB
        }),
        secret: env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            sameSite: 'lax',
        },
    })
);

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Rate limiting
app.use('/api', apiLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/repositories', repositoriesRoutes);
app.use('/api/deployments', deploymentsRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

const PORT = env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📝 Environment: ${env.NODE_ENV}`);
    console.log(`🌐 Frontend URL: ${env.FRONTEND_URL}`);
    console.log(`🔗 Backend URL: ${env.BACKEND_URL}`);
});

