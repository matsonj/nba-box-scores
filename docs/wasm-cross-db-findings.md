# WASM Cross-Database Query Findings

## Issue #112: Verify MotherDuck WASM cross-database queries

### Summary

Cross-database queries **are supported** in the MotherDuck WASM client, but the WASM client does **not** automatically attach all databases in a workspace. Databases must be explicitly attached before they can be queried.

### Current Setup

The app initializes a MotherDuck WASM connection in `lib/initMotherDuckConnection.ts` via `MDConnection.create({ mdToken })`. No database is explicitly set or attached after initialization -- the comment on line 24 notes:

```
// No USE needed — all queries use fully-qualified table names
// (e.g. nba_box_scores_v2.main.schedule)
```

All NBA source tables in `constants/tables.ts` use fully-qualified three-part names (e.g., `nba_box_scores_v2.main.schedule`), which already works correctly.

### Cross-Database Query Support

Per MotherDuck documentation:

1. **Fully-qualified table names work across databases.** A single query can reference tables from multiple databases using the `database.schema.table` format. For example:
   ```sql
   SELECT * FROM nba_box_scores_v2.main.schedule
   UNION ALL
   SELECT * FROM nhl_box_scores.main.schedule
   ```

2. **The WASM client requires explicit ATTACH.** Unlike the CLI or Python client (which auto-attach all workspace databases in "workspace mode"), the WASM client does **not** auto-attach databases. Each database you need must be explicitly attached in the session.

3. **ATTACH syntax:**
   ```sql
   ATTACH 'md:nhl_box_scores';
   ```
   The `md:` prefix is required for MotherDuck remote databases. No extension loading is needed -- the WASM client handles this automatically.

### Configuration Needed for NHL Integration

To query the `nhl_box_scores` database from the existing WASM connection, the app must run an `ATTACH` statement after the connection initializes. The recommended approach:

1. **Option A (explicit attach at init):** Add `ATTACH 'md:nhl_box_scores';` to the initialization flow in `initMotherDuckConnection.ts`, right after `await _connection.isInitialized()`.

2. **Option B (lazy attach):** Run the `ATTACH` statement on first use of NHL data, e.g., when the user navigates to an NHL route. This avoids attaching a database that may not be needed for every session.

Once attached, NHL tables can be referenced with fully-qualified names (e.g., `nhl_box_scores.main.schedule`) in the same queries that reference NBA tables -- including cross-database JOINs.

### Recommendation

Use **Option B (lazy attach)** for the NHL integration:

- Add an `attachDatabase` utility that runs `ATTACH 'md:<db_name>'` idempotently (catch errors if already attached).
- Call it from NHL-specific data loading code before executing NHL queries.
- Define NHL source table constants in `constants/tables.ts` using the same fully-qualified pattern already established for NBA tables (e.g., `nhl_box_scores.main.schedule`).
- No changes to the core `MotherDuckContext` or `initMotherDuckConnection` are required.

### Sources

- [MotherDuck: Specifying different databases](https://motherduck.com/docs/key-tasks/database-operations/specifying-different-databases/)
- [MotherDuck: Object name resolution](https://motherduck.com/docs/concepts/object-name-resolution/)
- [MotherDuck: Attach modes](https://motherduck.com/docs/key-tasks/authenticating-and-connecting-to-motherduck/attach-modes/)
- [MotherDuck SQL Reference: ATTACH](https://motherduck.com/docs/sql-reference/motherduck-sql-reference/attach/)
- [@motherduck/wasm-client README](../node_modules/@motherduck/wasm-client/README.md)
