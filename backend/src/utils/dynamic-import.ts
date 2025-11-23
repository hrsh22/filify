/**
 * Ensures we call the native `import()` at runtime even though the backend
 * compiles to CommonJS, so ESM-only packages load correctly in production.
 */
export const dynamicImport = new Function('specifier', 'return import(specifier);') as (
  specifier: string
) => Promise<any>;

