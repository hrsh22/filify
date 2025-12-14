// Wallet Configuration
export const REOWN_PROJECT_ID = 'acf9536ae2f5e07d7e38bbbd1bc80326';

if (!REOWN_PROJECT_ID) {
    throw new Error('REOWN_PROJECT_ID must be set in src/utils/constants.ts');
}

// API Configuration
export const BACKEND_URL = import.meta.env.VITE_ENV === 'dev'
    ? 'https://filify.hrsh22.me'
    : 'https://filify-backend.hrsh22.me';
export const API_URL = `${BACKEND_URL}/api`;
