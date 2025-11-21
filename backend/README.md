# Filecoin Pin + ENS Deployment Platform - Backend API

Backend API server for the Filecoin Pin + ENS deployment platform MVP.

## Features

- **GitHub OAuth Authentication** - Secure authentication with GitHub
- **Project Management** - Create, update, and manage deployment projects
- **GitHub Integration** - Fetch repositories and branches
- **Build Execution** - Clone and build repositories automatically
- **ENS Updates** - Update ENS contenthash with IPFS CIDs
- **Deployment Tracking** - Monitor deployment status and history

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: SQLite with Drizzle ORM
- **Authentication**: Passport.js with GitHub OAuth Strategy
- **Session Management**: express-session with connect-sqlite3
- **GitHub API**: @octokit/rest
- **Blockchain**: ethers.js v6 for ENS updates
- **Encryption**: Node.js crypto module (AES-256-GCM)
- **Build Execution**: child_process
- **Validation**: Zod
- **Security**: helmet, cors, express-rate-limit

## Setup

### Prerequisites

- Node.js 18 or higher
- npm, yarn, or pnpm
- GitHub OAuth App credentials

### Installation

1. **Install dependencies**:

    ```bash
    npm install
    ```

2. **Create environment file**:

    ```bash
    cp .env.example .env
    ```

3. **Configure environment variables**:
   Edit `.env` and fill in all required values:

    - `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` - Get from [GitHub OAuth Apps](https://github.com/settings/applications/new)
    - `SESSION_SECRET` - Generate with: `openssl rand -base64 32`
    - `ENCRYPTION_KEY` - Generate with: `openssl rand -hex 32` (must be exactly 64 hex characters)
    - `FRONTEND_URL` and `BACKEND_URL` - Your frontend and backend URLs

4. **Generate database migrations**:

    ```bash
    npm run db:generate
    ```

5. **Run database migrations**:
    ```bash
    npm run db:migrate
    ```

## Development

### Start development server:

```bash
npm run dev
```

The server will start on `http://localhost:3000` (or the port specified in `.env`).

### Database Studio:

```bash
npm run db:studio
```

Opens Drizzle Studio to view and manage database records.

## API Endpoints

### Authentication

- `GET /api/auth/github` - Initiate GitHub OAuth
- `GET /api/auth/github/callback` - OAuth callback handler
- `GET /api/auth/user` - Get current authenticated user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/status` - Check authentication status

### Projects

- `GET /api/projects` - List all user projects
- `POST /api/projects` - Create new project
- `GET /api/projects/:id` - Get single project details
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Repositories

- `GET /api/repositories` - Get user's GitHub repositories
- `GET /api/repositories/:owner/:repo/branches` - Get repository branches

### Deployments

- `POST /api/deployments` - Create new deployment (trigger build)
- `GET /api/deployments/:id` - Get deployment status
- `POST /api/deployments/:id/ens` - Update ENS with IPFS CID (called by frontend)
- `GET /api/projects/:id/deployments` - List project deployments

## Deployment Flow

1. **User triggers deployment** → `POST /api/deployments`
2. **Backend clones repo** → Updates status to `cloning`
3. **Backend runs build** → Updates status to `building`, stores logs
4. **Build completes** → Updates status to `uploading`
5. **Frontend uploads to Filecoin** → (happens on frontend)
6. **Frontend calls backend** → `POST /api/deployments/:id/ens` with IPFS CID
7. **Backend updates ENS** → Updates status to `updating_ens`
8. **ENS update completes** → Updates status to `success`, stores tx hash

### Status Flow:

```
cloning → building → uploading → updating_ens → success/failed
```

## Security

- All sensitive data (GitHub tokens, ENS private keys) are encrypted using AES-256-GCM
- Environment variables validated on startup
- CORS configured with frontend URL whitelist
- Rate limiting on all routes
- Session cookies with httpOnly and secure flags
- User ownership verified before all operations
- Input validation with Zod schemas

## Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration files
│   ├── db/              # Database schema and client
│   ├── middleware/      # Express middleware
│   ├── routes/          # API routes
│   ├── controllers/     # Route controllers
│   ├── services/        # Business logic services
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Utility functions
│   └── server.ts        # Express app entry point
├── drizzle/             # Database migrations
├── data/                # SQLite database and sessions
└── dist/                # Compiled JavaScript
```

## Testing

### Manual Testing Checklist:

1. **Authentication**:

    - GET /api/auth/github → redirects to GitHub
    - Callback returns to frontend with session
    - GET /api/auth/user → returns user info
    - POST /api/auth/logout → clears session

2. **Projects**:

    - POST /api/projects → creates project
    - GET /api/projects → lists user projects
    - GET /api/projects/:id → gets project details
    - PUT /api/projects/:id → updates project
    - DELETE /api/projects/:id → deletes project

3. **Repositories**:

    - GET /api/repositories → lists GitHub repos

4. **Deployments**:
    - POST /api/deployments → starts build
    - GET /api/deployments/:id → polls status
    - POST /api/deployments/:id/ens → updates ENS
    - GET /api/projects/:id/deployments → lists deployments

## Important Notes

- **Filecoin upload is handled by frontend** - backend just provides build output
- Backend updates status to `uploading` when build completes
- Frontend uploads files and calls backend with IPFS CID
- Backend then updates ENS and marks deployment as `success`
- ENS uses ETH mainnet
- Temp build directories in `/tmp/deployments` (cleaned up after builds)
- Sessions stored in SQLite for simplicity (use Redis in production)

## License

MIT
