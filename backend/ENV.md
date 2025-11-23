# Environment Variables

This document lists all required and optional environment variables for the backend API.

## Required Environment Variables

### Server Configuration

- **`NODE_ENV`** (optional, default: `development`)

    - Environment: `development`, `production`, or `test`
    - Example: `NODE_ENV=development`

- **`PORT`** (optional, default: `3000`)

    - Server port number
    - Example: `PORT=3000`

- **`FRONTEND_URL`** (required)

    - Frontend application URL (used for CORS and OAuth redirects)
    - Must be a valid URL
    - Example: `FRONTEND_URL=http://localhost:5173`

- **`BACKEND_URL`** (required)
    - Backend API URL (used for OAuth callback)
    - Must be a valid URL
    - Example: `BACKEND_URL=http://localhost:3000`

### GitHub OAuth

- **`GITHUB_CLIENT_ID`** (required)

    - GitHub OAuth App Client ID
    - Get from: https://github.com/settings/applications/new
    - Example: `GITHUB_CLIENT_ID=your_client_id_here`

- **`GITHUB_CLIENT_SECRET`** (required)
    - GitHub OAuth App Client Secret
    - Get from: https://github.com/settings/applications/new
    - Example: `GITHUB_CLIENT_SECRET=your_client_secret_here`

### Session Management

- **`SESSION_SECRET`** (required)
    - Secret key for session encryption (minimum 32 characters)
    - Generate with: `openssl rand -base64 32`
    - Example: `SESSION_SECRET=your_random_secret_min_32_chars_long`

### Database

- **`DATABASE_URL`** (optional, default: `sqlite:./data/dev.db`)
    - SQLite database file path
    - Format: `sqlite:./path/to/database.db`
    - Example: `DATABASE_URL=sqlite:./data/dev.db`

### Encryption

- **`ENCRYPTION_KEY`** (required)
    - AES-256-GCM encryption key (must be exactly 64 hex characters = 32 bytes)
    - Generate with: `openssl rand -hex 32`
    - Example: `ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef`

- **`GITHUB_WEBHOOK_SECRET_ENCRYPTION_KEY`** (required)
    - Dedicated AES-256-GCM key for encrypting GitHub webhook secrets
    - Must be exactly 64 hex characters (32 bytes)
    - Generate with: `openssl rand -hex 32`
    - Example: `GITHUB_WEBHOOK_SECRET_ENCRYPTION_KEY=abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789`

### Ethereum/ENS

- **`DEFAULT_ETHEREUM_RPC`** (optional, default: `https://eth-mainnet.g.alchemy.com/v2/${process.env.VITE_ALCHEMY_KEY}`)
    - Ethereum RPC endpoint URL
    - Used for ENS updates
    - Example: `DEFAULT_ETHEREUM_RPC=https://eth-mainnet.g.alchemy.com/v2/${process.env.VITE_ALCHEMY_KEY}`

### Build Cleanup

- **`CLEANUP_BUILDS_ON_COMPLETE`** (optional, default: `true`)
    - Whether to automatically delete build directories after deployment completes (success or failed)
    - Set to `false` to keep build artifacts for debugging
    - Example: `CLEANUP_BUILDS_ON_COMPLETE=true`

## Example .env File

```env
# Server
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3000

# GitHub OAuth
# Register at: https://github.com/settings/applications/new
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Session Secret (generate with: openssl rand -base64 32)
SESSION_SECRET=your_random_session_secret_min_32_chars

# Database
DATABASE_URL=sqlite:./data/dev.db

# Encryption Key (generate with: openssl rand -hex 32)
# MUST be exactly 64 hex characters (32 bytes)
ENCRYPTION_KEY=your_64_character_hex_encryption_key
GITHUB_WEBHOOK_SECRET_ENCRYPTION_KEY=your_second_64_character_hex_key

# Default Ethereum RPC
DEFAULT_ETHEREUM_RPC=https://eth-mainnet.g.alchemy.com/v2/${process.env.VITE_ALCHEMY_KEY}

# Build Cleanup (set to false to keep build artifacts)
CLEANUP_BUILDS_ON_COMPLETE=true
```

## Quick Setup Commands

Generate session secret:

```bash
openssl rand -base64 32
```

Generate encryption key:

```bash
openssl rand -hex 32
```

## GitHub OAuth Setup

1. Go to https://github.com/settings/applications/new
2. Fill in:
    - **Application name**: Your app name
    - **Homepage URL**: Your frontend URL
    - **Authorization callback URL**: `{BACKEND_URL}/api/auth/github/callback`
3. Copy the **Client ID** and **Client Secret** to your `.env` file

## Security Notes

- **Never commit `.env` file** to version control
- **ENCRYPTION_KEY** must be exactly 64 hex characters
- **SESSION_SECRET** should be at least 32 characters
- Use strong, randomly generated values for production
- Keep secrets secure and rotate them periodically
