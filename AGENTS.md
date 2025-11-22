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

**Last Updated**: 2025-01-27 (Initial documentation)

Filify is a decentralized deployment platform that enables developers to deploy web applications to Filecoin storage and serve them via Ethereum Name Service (ENS) domains.

### Core Workflow

1. User authenticates via GitHub OAuth
2. User creates a project linking a GitHub repository
3. User configures ENS domain and build settings
4. User triggers deployment
5. Backend clones repository and builds project
6. Frontend uploads build artifacts to Filecoin
7. Backend updates ENS contenthash with IPFS CID
8. Deployment is accessible via ENS domain

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
- Project creation and management
- Real-time deployment status tracking
- Filecoin upload with progress monitoring
- ENS domain configuration
- Deployment history viewing
- Resume failed deployments capability

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

- Build Service: Handles repository cloning, dependency installation, and project building. Supports Next.js, Node.js, and static sites. Auto-detects project types and output directories.
- ENS Service: Updates ENS contenthash with IPFS CIDs. Normalizes CID formats, encodes contenthash, and verifies updates.
- GitHub Service: Integrates with GitHub API to fetch repositories and branches using encrypted OAuth tokens.
- Encryption Service: Provides AES-256-GCM encryption/decryption for sensitive data (tokens, private keys).

**Endpoints**: All API endpoints are functional and documented in README.md. Authentication, projects, repositories, and deployments are fully implemented.

---

## Database Schema

### Tables

- **users**: GitHub OAuth user information and encrypted tokens
- **projects**: Deployment project configurations (repo, ENS, build settings)
- **deployments**: Deployment records with status, logs, IPFS CIDs, transaction hashes

### Schema Details

- Schema is stable with users, projects, and deployments tables.

---

## Features & Functionality

### Authentication

- **Method**: GitHub OAuth 2.0
- **Session Storage**: SQLite (sessions table)
- **Security**: Encrypted tokens, httpOnly cookies

**Current State**: GitHub OAuth 2.0 flow fully implemented. Users authenticate via GitHub, tokens are encrypted and stored. Sessions managed via SQLite with 7-day expiration. Protected routes enforce authentication.

### Project Management

- **Repository Selection**: From user's GitHub repositories
- **Branch Selection**: Any branch can be deployed
- **Build Configuration**: Custom build commands and output directories
- **ENS Configuration**: Domain name and private key (encrypted)

**Current State**: Full CRUD operations for projects. Users can create projects by selecting GitHub repositories and branches. ENS configuration includes domain name and encrypted private key. Build configuration supports custom commands and output directories. Project history shows all deployments.

### Build Process

- **Detection**: Automatically detects Next.js, Vite, static sites
- **Build Execution**: Runs in isolated directories
- **Output Detection**: Auto-detects output directories (out, dist, build, .next)
- **Logs**: Real-time build logs stored in database

**Current State**: Build service automatically detects Next.js, Node.js, and static projects. For Next.js, automatically creates static export config if missing. Builds run in isolated directories under `/tmp/deployments`. Build logs are captured and stored. Supports resuming from previous builds to skip cloning/building steps.

### Filecoin Integration

- **Library**: filecoin-pin
- **Network**: Filecoin Calibration testnet (currently)
- **Upload Flow**: CAR creation → Storage Provider upload → IPNI indexing → Onchain commitment
- **Progress Tracking**: Real-time upload progress

**Current State**: Uses filecoin-pin library for uploads. Currently configured for Filecoin Calibration testnet. Upload process includes CAR creation, storage provider selection, IPNI indexing, and onchain commitment. Progress tracking shows real-time status. Uses session key authentication (shared wallet approach for demo).

### ENS Updates

- **Method**: Updates resolver's contenthash via setContenthash function
- **Network**: Ethereum mainnet
- **CID Format**: Normalizes CIDv0/CIDv1 to base58btc format
- **Verification**: Post-update verification of contenthash

**Current State**: ENS updates fully functional. Normalizes IPFS CIDs (CIDv0/CIDv1) to base58btc format. Encodes contenthash using EIP-1577 standard. Updates resolver contract via setContenthash function. Verifies updates post-transaction. Stores transaction hashes in database.

### Deployment Status Flow

```
cloning → building → uploading → updating_ens → success/failed
```

**Current State**: Status flow is: `cloning → building → uploading → updating_ens → success/failed`. Each status is tracked in database. Frontend polls for status updates. Failed deployments can be resumed from previous build artifacts.

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

### Repository Endpoints

- `GET /api/repositories` - Get user's GitHub repositories
- `GET /api/repositories/:owner/:repo/branches` - Get repository branches

### Deployment Endpoints

- `POST /api/deployments` - Create new deployment (trigger build)
- `GET /api/deployments/:id` - Get deployment status
- `POST /api/deployments/:id/ens` - Update ENS with IPFS CID
- `GET /api/projects/:id/deployments` - List project deployments

**Status**: All endpoints are functional. Full REST API for authentication, projects, repositories, and deployments.

---

## Security Implementation

### Data Encryption

- **Algorithm**: AES-256-GCM
- **Encrypted Data**: GitHub tokens, ENS private keys
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

**Status**: Security implementation is stable. All sensitive data encrypted with AES-256-GCM. CORS, rate limiting, and input validation in place. User ownership verified for all operations.

---

## Environment Configuration

### Frontend Environment Variables

- `VITE_API_URL` - Backend API URL
- `VITE_WALLET_ADDRESS` - Filecoin wallet address
- `VITE_SESSION_KEY` - Session key for filecoin-pin

### Backend Environment Variables

- `PORT` - Server port
- `NODE_ENV` - Environment (development/production)
- `FRONTEND_URL` - Frontend URL for CORS
- `BACKEND_URL` - Backend URL
- `DATABASE_URL` - SQLite database path
- `SESSION_SECRET` - Session encryption secret
- `ENCRYPTION_KEY` - AES encryption key (64 hex chars)
- `GITHUB_CLIENT_ID` - GitHub OAuth client ID
- `GITHUB_CLIENT_SECRET` - GitHub OAuth client secret

**Status**: Environment variables are documented in frontend/ENV.md and backend/ENV.md. Configuration is stable.

---

## Known Issues & Limitations

### Current Limitations

- Runs on Filecoin Calibration testnet (not mainnet)
- Session key-based authentication (not production-ready for multi-user)
- SQLite database (consider PostgreSQL for production)
- No "bring your own wallet" support yet
- Build artifacts stored temporarily in `/tmp/deployments`

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
