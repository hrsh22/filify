# Agents Documentation

> **Purpose**: This document tracks the current state and details of the Filify application. It is updated after each agent interaction to maintain an accurate picture of the application's current state. This is NOT a changelog, but rather a living document that reflects what the application is and how it works right now.

## Instructions for AI Agents

**IMPORTANT**: After making any changes to the codebase, you MUST update this document to reflect the current state of the application.

### Update Guidelines

1. **Always update after changes** - Every agent call that modifies code should update this document
2. **Update current state** - Modify the "Current State" sections to reflect the actual current state
3. **Be specific** - Document what the current state is, not what changed
4. **Maintain accuracy** - Keep this document as the source of truth for the current application state
5. **Focus on now** - Document what exists now, not what might exist in the future

---

## Application Overview

**Last Updated**: 2025-11-22

Filify is a decentralized deployment platform that enables developers to deploy web applications to Filecoin storage and serve them via Ethereum Name Service (ENS) domains.

### Core Workflow

1. User connects their Ethereum wallet on mainnet via Reown AppKit (WalletConnect) inside the frontend.
2. Once a wallet is connected, the user authenticates via GitHub OAuth (GitHub login is disabled until a wallet connection exists).
3. User creates a project linking a GitHub repository, ENS settings, and choosing an auto-deploy branch while the GitHub webhook is registered automatically
4. Manual deployments can be triggered from the dashboard/project page
5. Auto-deployments fire when GitHub sends a push webhook; the backend enqueues a build job per project
6. Backend clones the repository, builds it, and stores build artifacts for up to 24h
7. The frontend auto-deploy poller downloads pending artifacts, uploads them to Filecoin via `filecoin-pin`, and receives an IPFS CID
8. The backend prepares the ENS resolver transaction while the connected wallet signs & broadcasts it to Ethereum mainnet
9. Once the transaction confirms, the backend verifies the resolver contenthash so the ENS domain resolves to the new IPFS CID

---

## Architecture

### Frontend (`frontend/`)

**Framework**: React 19 with TypeScript  
**Build Tool**: Vite  
**Routing**: React Router v7  
**State Management**: React Context API  
**Filecoin Integration**: `filecoin-pin` library  
**UI Library**: Radix UI + Tailwind CSS

#### Key Components

- **Authentication**: GitHub OAuth flow with session management
- **Project Management**: Create, view, and manage deployment projects
- **Deployment Tracking**: Real-time status updates and deployment history
- **Filecoin Upload**: Integration with filecoin-pin for decentralized storage

#### Current State

**Pages**:

- Landing page with feature overview
- Dashboard for project management
- Project detail page with deployment controls
- Deployment detail page with status and logs
- New project creation form
- Auth callback and error pages

**Key Features**:

- GitHub OAuth authentication flow
- Ethereum wallet connection via Reown AppKit (WalletConnect) limited to mainnet
- Project creation and management
- Real-time deployment status tracking
- Filecoin upload with progress monitoring
- ENS domain configuration
- Deployment history viewing
- Resume failed deployments capability
- Auto-deploy polling that uploads backend-built artifacts automatically when webhooks fire
- Project settings UI for monitoring GitHub push webhook status, switching the auto-deploy branch, or disabling auto-deploy if needed

**Components**:

- Authentication components (sign-in/sign-out buttons)
- Project management (cards, forms, empty states)
- Deployment tracking (status badges, steps, logs)
- UI components (buttons, cards, inputs, badges, spinners, skeletons)
- Layout components (dashboard layout, app header)

### Backend (`backend/`)

**Framework**: Express.js  
**Database**: SQLite with Drizzle ORM  
**Authentication**: Passport.js (GitHub OAuth)  
**Encryption**: AES-256-GCM for sensitive data  
**Blockchain**: ethers.js v6 for ENS updates

#### Key Services

- **Build Service**: Clones repos, installs dependencies, builds projects
- **ENS Service**: Updates ENS contenthash with IPFS CIDs
- **GitHub Service**: Integrates with GitHub API for repository access
- **Encryption Service**: Handles encryption/decryption of sensitive data

#### Current State

**Services**:

- Build Service: Handles repository cloning, dependency installation, and project building. Supports Next.js, Node.js, and static sites, auto-detects project types/output directories, queues builds per project, enforces 15-minute subprocess timeouts, and retains artifacts for 24h with automatic cleanup.
- ENS Service: Normalizes IPFS CIDs, prepares ENS resolver calldata (resolver address, calldata, gas estimate), and verifies the on-chain contenthash once the user's wallet broadcasts the transaction.
- GitHub Service: Integrates with GitHub API to fetch repositories/branches and to register/unregister push webhooks using encrypted secrets.
- Encryption Service: Provides AES-256-GCM encryption/decryption for sensitive data (GitHub tokens, webhook secrets) plus a dedicated key for encrypting GitHub webhook secrets.

**Endpoints**: All API endpoints are functional and documented in README.md. Authentication, projects, repositories, and deployments are fully implemented.

---

## Database Schema

### Tables

- **users**: GitHub OAuth user information and encrypted tokens
- **projects**: Deployment project configurations (repo, ENS, build settings)
- **deployments**: Deployment records with status, logs, IPFS CIDs, transaction hashes

### Schema Details

- `projects` now store `auto_deploy_branch`, `webhook_enabled`, and encrypted `webhook_secret` metadata so each project can manage its own GitHub webhook configuration.
- `projects` persist the ENS owner address (lowercased) instead of private keys so resolver transactions are always signed by the connected wallet.
- `deployments` track `triggered_by` (`manual`/`webhook`), `commit_sha`, `commit_message`, and a `build_artifacts_path` pointer so the frontend can download backend-built files.

---

## Features & Functionality

### Authentication

- **Method**: Dual flow — Ethereum wallet connection via Reown AppKit (WalletConnect on mainnet) plus GitHub OAuth 2.0
- **Session Storage**: SQLite (sessions table)
- **Wallet Stack**: `@reown/appkit`, `@reown/appkit-adapter-wagmi`, `wagmi`, and React Query for provider state
- **Security**: Encrypted tokens, httpOnly cookies

**Current State**: Users must connect an Ethereum wallet before the GitHub login button becomes active. Wallet status is managed globally through the AppKit/Wagmi provider, and ProtectedRoute now enforces that both a wallet connection and a GitHub session exist before rendering any dashboard routes. Logging out also disconnects the wallet to keep both auth states aligned.

### Project Management

- **Repository Selection**: From user's GitHub repositories
- **Branch Selection**: Any branch can be deployed
- **Build Configuration**: Custom build commands and output directories
- **ENS Configuration**: Domain name (selected from wallet-owned ENS names) and the corresponding owner address

**Current State**: Full CRUD operations for projects. When users create a project, they select a GitHub repository/branch, configure ENS + build settings, and the backend automatically registers the GitHub webhook for auto-deploy using the selected branch. The ENS domain combobox is populated from the connected wallet via the ENS subgraph, and the backend stores only the owner address so signatures always happen client-side. Project settings allow switching the auto-deploy branch or disabling the webhook entirely. Project history shows all deployments with trigger provenance and commit metadata.

### Build Process

- **Detection**: Automatically detects Next.js, Vite, static sites
- **Build Execution**: Runs in isolated directories
- **Output Detection**: Auto-detects output directories (out, dist, build, .next)
- **Logs**: Real-time build logs stored in database

**Current State**: Build service automatically detects Next.js, Node.js, and static projects. For Next.js, it creates a static export config if missing. Builds run in isolated directories under the repo-level `builds/` folder (auto-cleaned after 24h), and only one build per project runs at a time via an in-memory queue. Build logs are captured, output folders are recorded for artifact downloads, and failed runs can still resume from cached workspaces.

### Filecoin Integration

- **Library**: filecoin-pin
- **Network**: Filecoin Calibration testnet (currently)
- **Upload Flow**: CAR creation → Storage Provider upload → IPNI indexing → Onchain commitment
- **Progress Tracking**: Real-time upload progress

**Current State**: Uses filecoin-pin library for uploads. Currently configured for Filecoin Calibration testnet. Upload process includes CAR creation, storage provider selection, IPNI indexing, and onchain commitment. Progress tracking shows real-time status. Uses session key authentication (shared wallet approach for demo).

### ENS Updates

- **Method**: Backend prepares resolver calldata, the connected wallet signs & broadcasts `setContenthash`, backend verifies the resolver afterwards
- **Network**: Ethereum mainnet
- **CID Format**: Normalizes CIDv0/CIDv1 to base58btc format
- **Verification**: Post-update verification of contenthash plus ENS tx hash tracking

**Current State**: ENS updates are coordinated between the backend and the connected wallet. After Filecoin upload finishes, the backend returns the resolver address, calldata, and gas estimate. The auto-deploy poller (and deployment detail page) prompts the wallet to sign and broadcast the transaction. The backend then watches the transaction, verifies the resolver contenthash, and records the tx hash. No ENS private keys are stored anywhere in the system.

### Deployment Status Flow

```
pending_build → cloning → building → pending_upload → uploading → awaiting_signature → awaiting_confirmation → success/failed
```

**Current State**: The backend records queue/build progress (`pending_build`/`cloning`/`building`), then exposes artifacts through `pending_upload`. The frontend auto-deploy poller transitions deployments to `uploading` while it pushes artifacts to Filecoin. Once the backend prepares the ENS transaction, deployments move to `awaiting_signature` until the wallet signs and `awaiting_confirmation` while Ethereum finalizes. Manual uploads still use the same statuses, and failed deployments can be resumed from previous build artifacts.

---

## API Endpoints

### Authentication Endpoints

- `GET /api/auth/github` - Initiate GitHub OAuth
- `GET /api/auth/github/callback` - OAuth callback handler
- `GET /api/auth/user` - Get current authenticated user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/status` - Check authentication status

### Project Endpoints

- `GET /api/projects` - List all user projects
- `POST /api/projects` - Create new project
- `GET /api/projects/:id` - Get single project details
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project
- `POST /api/projects/:id/webhook/enable` - Register GitHub push webhook + enable auto deploy
- `POST /api/projects/:id/webhook/disable` - Remove GitHub push webhook + disable auto deploy

### Repository Endpoints

- `GET /api/repositories` - Get user's GitHub repositories
- `GET /api/repositories/:owner/:repo/branches` - Get repository branches

### Deployment Endpoints

- `POST /api/deployments` - Create new deployment (manual trigger)
- `GET /api/deployments` - List deployments with optional status/limit filters (used by auto-deploy poller)
- `GET /api/deployments/:id` - Get deployment status
- `GET /api/deployments/:id/artifacts` - Download backend build artifacts as a zip
- `POST /api/deployments/:id/upload/fail` - Mark upload as failed (used when Filecoin upload errors)
- `POST /api/deployments/:id/ens/prepare` - Normalize CID + return resolver calldata for the wallet to sign
- `POST /api/deployments/:id/ens/confirm` - Record a signed transaction hash and verify the resolver contenthash
- `GET /api/projects/:id/deployments` - List project deployments

### Webhook Endpoint

- `POST /api/webhooks/github` - GitHub push webhook receiver (HMAC verified, enqueues `pending_build` deployments)

**Status**: All endpoints are functional. Auto-deploy webhooks, artifact downloads, and deployment filtering are available in addition to the existing authentication/project/repository APIs.

---

## Security Implementation

### Data Encryption

- **Algorithm**: AES-256-GCM
- **Encrypted Data**: GitHub tokens, webhook secrets, session secrets
- **Storage**: Encrypted values stored in database

### Session Management

- **Storage**: SQLite sessions table
- **Cookie Settings**: httpOnly, secure (production), sameSite: lax
- **Expiration**: 7 days

### API Security

- **CORS**: Configured with frontend URL whitelist
- **Rate Limiting**: Applied to all API routes
- **Input Validation**: Zod schemas for request validation
- **Authorization**: User ownership verified before operations

**Status**: Security implementation is stable. All sensitive data encrypted with AES-256-GCM. CORS, rate limiting, and input validation in place. User ownership verified for all operations, and GitHub webhook secrets automatically rotate whenever a signature mismatch is detected to self-heal broken webhooks.

---

## Environment Configuration

### Frontend Environment Variables

- `VITE_REOWN_PROJECT_ID` - Reown AppKit project ID for wallet connectivity (required)
- `VITE_API_URL` - Backend API URL
- `VITE_WALLET_ADDRESS` - Filecoin wallet address
- `VITE_SESSION_KEY` - Session key for filecoin-pin
- `VITE_THEGRAPH_API_KEY` - API key for The Graph gateway (used for ENS domain discovery)

### Backend Environment Variables

- `PORT` - Server port
- `NODE_ENV` - Environment (development/production)
- `FRONTEND_URL` - Frontend URL for CORS
- `BACKEND_URL` - Backend URL
- `DATABASE_URL` - SQLite database path
- `SESSION_SECRET` - Session encryption secret
- `ENCRYPTION_KEY` - AES encryption key (64 hex chars)
- `GITHUB_WEBHOOK_SECRET_ENCRYPTION_KEY` - Dedicated AES key for encrypting GitHub webhook secrets
- `GITHUB_CLIENT_ID` - GitHub OAuth client ID
- `GITHUB_CLIENT_SECRET` - GitHub OAuth client secret

**Status**: Environment variables are documented in frontend/ENV.md and backend/ENV.md. Configuration is stable.

---

## Known Issues & Limitations

### Current Limitations

- Runs on Filecoin Calibration testnet (not mainnet)
- Session key-based authentication (not production-ready for multi-user)
- SQLite database (consider PostgreSQL for production)
- Filecoin uploads still rely on the shared session wallet (wallet connect is only used for dashboard access control)
- Build artifacts stored temporarily in the repo-level `builds/` folder (cleaned after ~24h)
- Wallet connection is limited to Ethereum mainnet via Reown AppKit (no Solana/multichain toggle yet)

### Known Issues

- None currently documented. Application is in MVP state and functional.

---

## Development Notes

### Build Detection Logic

The build service automatically detects project types:

- **Next.js**: Detects `next` in dependencies, ensures static export config
- **Node.js**: Detects `package.json`, runs npm install and build
- **Static**: No package.json, copies files to `__static_export__`

### Output Directory Detection

Auto-detects in order: `out`, `dist`, `build`, `.next`, `public`

### Resume Deployment Feature

Failed deployments can be resumed from previous builds:

- Reuses build artifacts from previous deployment
- Skips cloning and building steps
- Continues from upload or ENS update phase

**Status**: Build detection logic is stable. Supports Next.js (with auto static export config), Node.js projects, and static sites. Output directory auto-detection works for common patterns (out, dist, build, .next, public). Resume feature allows reusing previous build artifacts.

### Auto Deploy Pipeline

- GitHub push webhooks are registered per-project with encrypted secrets (auto-rotated if a signature mismatch is detected) and rate-limited intake.
- Each webhook event creates a `pending_build` deployment and is enqueued so only one build runs per project at a time.
- After the backend marks a deployment `pending_upload`, the frontend auto-deploy poller downloads artifacts, uploads them to Filecoin, and then requests an ENS payload from the backend.
- The poller (or the deployment detail page) prompts the connected wallet to sign the resolver transaction (debounced so the wallet only sees one prompt per deployment), submits the tx hash back to the backend, and the backend verifies the resolver before marking the deployment `success`.
- Upload failures are reported back via `POST /api/deployments/:id/upload/fail` so the UI shows a failed deployment with logs.

---

## Testing & Quality Assurance

### Frontend Testing

- **Framework**: Vitest
- **Test Files**: Located in `test/` directory
- **Coverage**: Basic test setup exists. Coverage not currently documented.

### Backend Testing

- **Framework**: No formal testing framework currently set up
- **Test Files**: No test files currently
- **Coverage**: No test coverage currently

### Code Quality

- **Linting**: Biome (frontend), ESLint (backend)
- **Formatting**: Biome (frontend), Prettier (backend)
- **Type Checking**: TypeScript strict mode

**Status**: Code quality tools are in place (Biome for frontend, ESLint/Prettier for backend). Testing infrastructure exists for frontend but needs expansion. Backend testing not yet implemented.

---

## Dependencies

### Frontend Key Dependencies

- `react` ^19.2.0
- `react-router-dom` ^7.0.2
- `@reown/appkit` + `@reown/appkit-adapter-wagmi` + `wagmi` for wallet connectivity
- `@tanstack/react-query` for Wagmi/AppKit provider state
- `filecoin-pin` ^0.12.0
- `axios` ^1.7.9
- `zod` ^3.23.8
- `@radix-ui/*` - UI components
- `tailwindcss` ^4.1.14

### Backend Key Dependencies

- `express` ^4.18.2
- `drizzle-orm` ^0.29.1
- `ethers` ^6.9.0
- `passport` ^0.7.0
- `passport-github2` ^0.1.12
- `@octokit/rest` ^20.0.2
- `zod` ^3.22.4

**Status**: Dependencies are stable. Frontend uses React 19, filecoin-pin 0.12.0, React Router v7. Backend uses Express 4.18.2, Drizzle ORM 0.29.1, ethers.js v6.9.0.

---

## Deployment & Production

### Current Deployment Status

- **Environment**: Development
- **Frontend URL**: http://localhost:5173 (dev)
- **Backend URL**: http://localhost:3000 (dev)
- **Database**: SQLite (local)
- **Filecoin Network**: Calibration testnet

## Notes for Future Agents

- Always update this document after making changes
- Be specific about what changed and why
- Maintain the structure and organization
- Update timestamps when making changes
- Keep the "Current State" sections accurate
- Document any architectural decisions or trade-offs

---

**Last Comprehensive Update**: 2025-01-27 - Initial documentation and state capture
