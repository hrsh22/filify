# Frontend Environment Variables

This document lists all environment variables for the frontend React application.

## Required Environment Variables

### Filecoin Pin Configuration

- **`VITE_FILECOIN_PRIVATE_KEY`** (required)
    - Filecoin wallet private key for authentication
    - Must be a valid private key (0x-prefixed hex string)
    - Example: `VITE_FILECOIN_PRIVATE_KEY=0x1234567890abcdef...`

## Optional Environment Variables

### API Configuration

- **`VITE_API_URL`** (optional, default: `http://localhost:3000/api`)

    - Backend API base URL
    - Used for all API requests
    - Example: `VITE_API_URL=http://localhost:3000/api`

- **`VITE_BACKEND_URL`** (optional, default: `http://localhost:3000`)
    - Backend server URL (without `/api` suffix)
    - Used for OAuth redirects and artifact downloads
    - Example: `VITE_BACKEND_URL=http://localhost:3000`

### Ethereum/ENS Configuration

- **`VITE_DEFAULT_ETHEREUM_RPC`** (optional, default: `https://eth-mainnet.g.alchemy.com/v2/${process.env.VITE_ALCHEMY_KEY}`)
    - Default Ethereum RPC URL for ENS operations
    - Pre-filled in the new project form
    - Example: `VITE_DEFAULT_ETHEREUM_RPC=https://eth-mainnet.g.alchemy.com/v2/${process.env.VITE_ALCHEMY_KEY}`

### Filecoin Pin Advanced Configuration

- **`VITE_FILECOIN_RPC_URL`** (optional)

    - Custom Filecoin RPC URL
    - Overrides default Filecoin network endpoint
    - Example: `VITE_FILECOIN_RPC_URL=https://api.filecoin.io/rpc/v1`

- **`VITE_WARM_STORAGE_ADDRESS`** (optional)
    - Warm storage address for Filecoin operations
    - Example: `VITE_WARM_STORAGE_ADDRESS=0x...`

## Example .env.local File

Create a `.env.local` file in the `frontend/` directory:

```env
# Required
VITE_FILECOIN_PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef

# Optional - API Configuration
VITE_API_URL=http://localhost:3000/api
VITE_BACKEND_URL=http://localhost:3000

# Optional - Ethereum/ENS
VITE_DEFAULT_ETHEREUM_RPC=https://eth-mainnet.g.alchemy.com/v2/${process.env.VITE_ALCHEMY_KEY}

# Optional - Filecoin Advanced
# VITE_FILECOIN_RPC_URL=https://api.filecoin.io/rpc/v1
# VITE_WARM_STORAGE_ADDRESS=0x...
```

## Notes

- All Vite environment variables must be prefixed with `VITE_` to be exposed to the client
- `.env.local` is git-ignored and should not be committed
- Restart the Vite dev server after changing environment variables
- Default values are used if environment variables are not set
- The Filecoin private key is **required** - the app will throw an error if it's missing

## Development Setup

1. Copy the example above to `.env.local`
2. Replace `VITE_FILECOIN_PRIVATE_KEY` with your actual Filecoin wallet private key
3. Adjust other values if your backend runs on a different port/URL
4. Restart the dev server: `npm run dev`
