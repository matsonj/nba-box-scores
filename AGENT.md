# NBA Box Scores Agent Guide

## Commands
- **Build**: `npm run build`
- **Dev**: `npm run dev`
- **Test**: `npm run test` (Jest) or `npm run test:watch`
- **Lint**: `npm run lint`
- **Single test**: `npm run test -- --testNamePattern="test name"`
- **Python**: Use `uv` for package management and running scripts

## Architecture
- **Frontend**: Next.js 15 with React 19, TypeScript, Tailwind CSS
- **Database**: MotherDuck (cloud DuckDB) with WASM client for browser persistence
- **Data Pipeline**: Python scripts in `/scripts` fetch NBA data and insert into MotherDuck
- **Key Components**: DataLoader class handles all DB queries, MotherDuckContext provides connection
- **Query MotherDuck**: `duckdb "md:nba_box_scores?attach_mode=single" -c "<query>"`

## Code Style
- **Imports**: Use `@/` for root imports, React components at top
- **Components**: Use TypeScript interfaces for props, 'use client' directive for client components
- **Naming**: PascalCase for components, camelCase for functions/variables
- **Error Handling**: Use try/catch blocks, log errors to console
- **Types**: Strict TypeScript enabled, use interfaces over types
- **Styling**: Tailwind classes with dark mode support

## Key Rules
- All MotherDuck queries must go through DataLoader class
- Use temp tables instead of direct table references
- Prioritize performance and user experience
- Reference underlying tables directly instead of temp tables when needed
