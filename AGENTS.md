# Agent Guidelines for Filify

## Build, Lint, and Test Commands

### Frontend (React + Vite)
```bash
# Development
npm run dev                  # Start dev server on port 5173

# Build & Typecheck
npm run build                # Build for production (runs typecheck first)
npm run typecheck            # TypeScript strict check (tsconfig.build.json)

# Linting & Formatting (Biome)
npm run lint                # Check code quality
npm run lint:fix            # Fix issues and format code

# Testing (Vitest)
npm run test                # Run all tests once
npm run test:watch          # Watch mode for development
npm run test:ui             # Vitest UI
vitest run <filename>       # Run a single test file
```

### Backend (Express + Node)
```bash
# Development
npm run dev                  # Start with tsx watch (port 3000)

# Build & Typecheck
npm run build                # Compile TypeScript to dist/
npm run start                # Start production server

# Linting & Formatting (ESLint + Prettier)
npm run lint                # Check code with ESLint
npm run format               # Format with Prettier

# Database
npm run db:generate          # Generate Drizzle migrations
npm run db:migrate          # Apply migrations
npm run db:studio           # Open Drizzle Studio GUI
```

## Code Style Guidelines

### Imports

**Frontend** (`/frontend`):
- Use **absolute imports** with `@/` alias for all internal modules
- Biome auto-organizes imports (external → internal)
- External libraries first, then internal modules
- Example: `import { Button } from '@/components/ui/button'`

**Backend** (`/backend`):
- Use **relative imports** only (`./`, `../`)
- External Node modules first, then internal project files
- Example: `import { logger } from '../utils/logger'`

### Formatting & Semicolons

**Frontend**: No semicolons (Biome `"semicolons": "asNeeded"`)
```typescript
const value = 42
export function example() {}
```

**Backend**: Always use semicolons (Prettier default)
```typescript
const value = 42;
export function example() {};
```

### Naming Conventions

- **Files**: kebab-case (enforced by Biome in frontend)
- **Variables/Functions**: camelCase
- **Components**: PascalCase (`export function ProjectCard() {}`)
- **Constants**: UPPER_SNAKE_CASE (`POLL_INTERVAL_MS`)
- **Types/Interfaces**: PascalCase (`interface Project {}`, `type DeploymentStatus`)
- **Services/Controllers**: Classes with singleton exports
  - Backend: `class GitHubService {}` → `export const githubService = new GitHubService()`
  - Frontend: `export const deploymentsService = {...}`

### Error Handling

**Frontend**:
- Use `try/catch/finally` for async operations
- Log with `[ComponentName][MethodName]` prefix: `console.error('[ProjectCard][deploy]', error)`
- User-facing errors: `showToast(message, 'error' | 'success' | 'info')`
- Handle wallet rejections specifically: check for `user rejected` or error code `4001`
- Silent failures allowed for non-critical operations (add `// Silently fail` comment)
- Axios interceptor at `/frontend/src/services/api.ts` handles 401s globally

**Backend**:
- Controllers: Wrap business logic in `try/catch`, return 500 on unexpected errors
- Services: Use `logger.error()` with structured metadata context
- HTTP error response format: `{ error: 'ErrorName', message: 'Description' }`
- Use Winston logger from `/backend/src/utils/logger.ts`
- Middleware handles validation errors (`validateRequest`) and unhandled exceptions (`errorHandler`)

### Export Styles

**Frontend**:
- Preferred: Named exports (`export function Component() {}`)
- Default exports: Only for `App` component (`export default function App() {}`)

**Backend**:
- Controllers/Services/Utils: Named exports (often singleton instances)
- Routers: Default exports (`export default router`)

### Type Safety

- **Frontend**: `import type { Type }` for type-only imports
- **Backend**: Explicit `any` casting only where unavoidable: `(req.user as any).id`
- Interfaces for object shapes where possible, types for unions/enums
- Never suppress type errors with `@ts-ignore` or `as any`

### Testing

- **Frontend**: Vitest with jsdom environment
- Test setup file: `/frontend/test/setup.ts` (auto-cleanup after each test)
- Use `@testing-library/react` for component testing
- No backend testing framework currently set up
