# NBA Box Scores App Troubleshooting

## Problem Summary

The NBA box scores app stopped rendering content when running in development mode. The app was last working in March 2024 but hadn't been deployed since March 30th, 2024.

## Initial Symptoms

- App loads but displays blank/empty page
- No obvious errors in terminal
- App structure appears intact
- React components not hydrating properly

## Root Cause Identified

**MotherDuck API Changes - BigInt Serialization Issue**

The core issue is that MotherDuck's WASM client now returns `BigInt` values for large numbers (particularly COUNT queries and similar operations). This breaks `JSON.stringify()` operations throughout the application, causing React hydration failures.

### Error Details
- **Error**: `TypeError: Do not know how to serialize a BigInt`
- **Location**: Any component that calls `JSON.stringify()` on MotherDuck query results
- **Cause**: MotherDuck WASM client behavior changed since March 30th, 2024

## Debugging Process Completed

1. **Environment Setup**: Updated all packages to latest versions
2. **React Hydration**: Confirmed React 19 + Next.js 15 working correctly
3. **MotherDuck Integration**: Created comprehensive debugging page to test each step
4. **Issue Isolation**: Pinpointed BigInt serialization as the root cause

## Current Status

### ✅ Completed
- Package updates (Next.js 15.3.4, React 19.0.0)
- TailwindCSS v4 compatibility fix
- MotherDuck connection and token retrieval working
- Root cause identified and partially fixed in debugging code

### 🔄 In Progress
- Created `safeStringify()` helper function for BigInt handling
- Applied fix to debugging page (`app/page.tsx`)

### ❌ Not Started
- Apply BigInt fix throughout entire application
- Restore full application functionality

## Technical Solution

### SafeStringify Helper Function
```typescript
function safeStringify(obj: any): string {
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'bigint') {
      return value.toString() + 'n';
    }
    return value;
  });
}
```

### Where to Apply Fix
The BigInt serialization issue affects any component that:
1. Queries MotherDuck data
2. Uses `JSON.stringify()` on query results
3. Passes data through React state or props

## Next Steps (Priority Order)

### 1. **Audit All MotherDuck Data Usage** (High Priority)
- Search for all `JSON.stringify()` calls in the codebase
- Identify components that query MotherDuck data
- Map data flow from MotherDuck to React components

**Files to check:**
- `lib/db.ts` - Database connection and queries
- `hooks/useBoxScore.ts` - Box score data fetching
- `hooks/useGameData.ts` - Game data fetching
- `components/BoxScore.tsx` - Main box score component
- `components/DynamicStatsTable.tsx` - Dynamic stats display
- `lib/queries/dynamicTableQuery.ts` - Dynamic table queries

### 2. **Implement BigInt Handling** (High Priority)
- Add `safeStringify()` utility to `lib/utils.ts`
- Replace all `JSON.stringify()` calls with `safeStringify()`
- Test each component individually

### 3. **Update Data Processing Pipeline** (Medium Priority)
- Check if Python scripts (`src/nba_box_scores/`) need updates
- Verify data loading scripts handle BigInt properly
- Test data pipeline from raw NBA data to MotherDuck

### 4. **Component-by-Component Testing** (Medium Priority)
- Start with core components (BoxScore, GameCard)
- Test data flow through each component
- Verify React hydration works correctly

### 5. **Full Integration Testing** (Low Priority)
- Test complete user workflows
- Verify all features work end-to-end
- Performance testing with large datasets

## Testing Strategy

### Quick Validation
1. Run development server: `npm run dev`
2. Check browser console for errors
3. Test basic navigation and data loading

### Comprehensive Testing
1. Test individual components in isolation
2. Verify MotherDuck queries return expected data types
3. Check React state updates work correctly
4. Test error handling for failed queries

## Key Technical Notes

- **MotherDuck Token**: API token generation still works correctly
- **WASM Client**: Connection and basic queries work, only BigInt serialization fails
- **React Hydration**: Fixed with package updates, now fails only due to BigInt issue
- **CORS Configuration**: Properly configured for localhost:3000

## Development Environment

- **Node.js**: Latest stable version
- **Next.js**: 15.3.4
- **React**: 19.0.0
- **MotherDuck**: WASM client (latest)
- **Port**: 3000 (matches CORS config)

## Useful Commands

```bash
# Start development server
npm run dev

# Debug specific component
# (Use the debugging page at localhost:3000)

# Run tests
npm test

# Check for TypeScript errors
npx tsc --noEmit
```

## Contact/Resources

- **MotherDuck Documentation**: https://motherduck.com/docs/
- **BigInt MDN**: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt
- **Next.js 15 Migration**: https://nextjs.org/docs/app/building-your-application/upgrading

## Estimated Timeline

- **BigInt Fix Implementation**: 2-4 hours
- **Component Testing**: 2-3 hours  
- **Full Integration Testing**: 1-2 hours
- **Total Estimated Time**: 5-9 hours

---

*Last Updated: December 2024*
*Status: Root cause identified, solution in progress* 