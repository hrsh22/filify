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

### GitHub App (Repository Access)

Authentication uses wallet-based SIWE (Sign-In With Ethereum). GitHub App is used for repository access only.

- **`GITHUB_APP_ID`** (required)

    - GitHub App ID
    - Get from: https://github.com/settings/apps → Your App → General → App ID
    - Example: `GITHUB_APP_ID=123456`

- **`GITHUB_APP_PRIVATE_KEY`** (required)

    - GitHub App private key (PEM format)
    - Get from: https://github.com/settings/apps → Your App → Private keys → Generate
    - Must include full PEM including `-----BEGIN RSA PRIVATE KEY-----` headers
    - Replace newlines with `\n` in the env var value
    - Example: `GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----"`

- **`GITHUB_APP_CLIENT_ID`** (optional)

    - GitHub App OAuth Client ID (for future OAuth flow if needed)
    - Get from: https://github.com/settings/apps → Your App → General → Client ID
    - Example: `GITHUB_APP_CLIENT_ID=Iv1.abc123def456`

- **`GITHUB_APP_CLIENT_SECRET`** (optional)

    - GitHub App OAuth Client Secret
    - Get from: https://github.com/settings/apps → Your App → General → Client secrets
    - Example: `GITHUB_APP_CLIENT_SECRET=your_client_secret`

- **`GITHUB_APP_WEBHOOK_SECRET`** (optional)
    - Webhook secret for GitHub App webhooks
    - Set in: https://github.com/settings/apps → Your App → Webhook → Secret
    - Example: `GITHUB_APP_WEBHOOK_SECRET=your_webhook_secret`

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

### Ethereum/ENS & External APIs

- **`ALCHEMY_KEY`** (required)
    - Alchemy API key for Ethereum RPC access
    - Get from: https://dashboard.alchemy.com/apps
    - Example: `ALCHEMY_KEY=your_alchemy_api_key`

- **`DEFAULT_ETHEREUM_RPC`** (optional, auto-generated from ALCHEMY_KEY)
    - Ethereum RPC endpoint URL for ENS operations
    - Defaults to: `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
    - Example: `DEFAULT_ETHEREUM_RPC=https://eth-mainnet.g.alchemy.com/v2/your_key`

- **`THEGRAPH_API_KEY`** (required)
    - The Graph API key for querying ENS subgraph
    - Get from: https://thegraph.com/studio/
    - Used by `/api/ens/domains/:address` endpoint
    - Example: `THEGRAPH_API_KEY=your_thegraph_api_key`

### Build Cleanup

- **`CLEANUP_BUILDS_ON_COMPLETE`** (optional, default: `true`)
    - Whether to automatically delete build directories after deployment completes (success or failed)
    - Set to `false` to keep build artifacts for debugging
    - Example: `CLEANUP_BUILDS_ON_COMPLETE=true`

### Filecoin Pin Configuration

- **`FILECOIN_PRIVATE_KEY`** (required)
    - Filecoin wallet private key for signing upload transactions
    - Must be a valid private key (0x-prefixed 64-character hex string)
    - Example: `FILECOIN_PRIVATE_KEY=0x1234567890abcdef...` (64 hex chars after 0x)

- **`FILECOIN_RPC_URL`** (optional)
    - Custom Filecoin RPC URL
    - Overrides default Filecoin network endpoint
    - Example: `FILECOIN_RPC_URL=https://api.calibration.node.glif.io/rpc/v1`

- **`WARM_STORAGE_ADDRESS`** (optional)
    - Custom warm storage contract address
    - Only needed for non-standard deployments
    - Example: `WARM_STORAGE_ADDRESS=0x...`

## Example .env File

```env
# Server
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3000

# GitHub App (for repository access)
# Create at: https://github.com/settings/apps/new
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----"

# Session Secret (generate with: openssl rand -base64 32)
SESSION_SECRET=your_random_session_secret_min_32_chars

# Database
DATABASE_URL=sqlite:./data/dev.db

# Encryption Key (generate with: openssl rand -hex 32)
# MUST be exactly 64 hex characters (32 bytes)
ENCRYPTION_KEY=your_64_character_hex_encryption_key
GITHUB_WEBHOOK_SECRET_ENCRYPTION_KEY=your_second_64_character_hex_key

# Ethereum/ENS
ALCHEMY_KEY=your_alchemy_api_key
THEGRAPH_API_KEY=your_thegraph_api_key

# Build Cleanup (set to false to keep build artifacts)
CLEANUP_BUILDS_ON_COMPLETE=true

# Filecoin
FILECOIN_PRIVATE_KEY=0x...
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

## GitHub App Setup

1. Go to https://github.com/settings/apps/new
2. Fill in:
    - **GitHub App name**: `filify` (or your preferred name)
    - **Homepage URL**: Your frontend URL
    - **Callback URL**: `{FRONTEND_URL}/github/callback`
    - **Setup URL**: (optional) `{FRONTEND_URL}/github/callback`
    - **Webhook URL**: `{BACKEND_URL}/api/webhooks/github` (if using webhooks)
    - **Webhook secret**: (Generate a random string) e.g., `my_local_webhook_secret`
    - **SSL verification**: Enable SSL verification (default)
3. Set permissions:
    - **Repository permissions**:
        - **Contents**: Read-only (to clone repositories)
        - **Metadata**: Read-only (auto-selected)
        - **Webhooks**: Read and write (to register repo webhooks automatically)
        - **Commit statuses**: Read and write (optional, for deployment status)
    - **Subscribe to events**: **Push** (triggers deployments)
4. Select **"Any account"** under "Where can this GitHub App be installed?"
5. After creating, go to **Settings** → **Developer settings** → **GitHub Apps** → **Your App** → **About**
6. Copy these values to your `backend/.env` file:

| Variable | Source |
| :--- | :--- |
| **GITHUB_APP_ID** | About page → General → App ID |
| **GITHUB_APP_NAME** | App name you chose |

7. **Private Key Setup** (use base64 encoding):

Download the private key `.pem` file, then encode it to base64:

```bash
# On Linux/Mac:
ENCODED_KEY=$(cat your-downloaded-key.pem | base64 -w 0)
echo "GITHUB_APP_PRIVATE_KEY=$ENCODED_KEY" >> backend/.env

# Or add it directly:
echo 'GITHUB_APP_PRIVATE_KEY="'$(cat your-downloaded-key.pem | base64 -w 0)'" >> backend/.env
```

The code will automatically decode it from base64 when reading the env var.

8. **Client ID and Secret** (for OAuth, optional but create them):

Go to **General** → **Client secrets** → **Generate a new client secret** → **GITHUB_APP_CLIENT_ID** → **GITHUB_APP_CLIENT_SECRET**

9. **Webhook Secret** (if using webhooks):

Add to `backend/.env`:
```bash
GITHUB_APP_WEBHOOK_SECRET=your_webhook_secret_here
```

> **⚠️ Important Note on Webhooks**: GitHub cannot send webhooks to `localhost`.
> To make auto-deployments work locally, you must use a tunneling service like **ngrok**.
> 1. Run: `ngrok http 3000`
> 2. Use the ngrok URL (e.g., `https://abcd-123.ngrok-free.app`) for **Webhook URL** and in your `.env` file (`BACKEND_URL`).

## Security Notes

- **Never commit `.env` file** to version control
- **ENCRYPTION_KEY** must be exactly 64 hex characters
- **SESSION_SECRET** should be at least 32 characters
- **GITHUB_APP_PRIVATE_KEY** should be kept secure - never expose it
- Use strong, randomly generated values for production
- Keep secrets secure and rotate them periodically
