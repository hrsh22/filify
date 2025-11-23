/**
 * Environment type definitions
 * Note: Environment variables are no longer used - all configuration is in src/utils/constants.ts
 */

declare global {
  interface Window {
    debugDump?: () => void
  }
}
