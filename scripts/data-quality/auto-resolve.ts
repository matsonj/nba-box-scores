// Auto-resolution logic for quarantined records.
// Currently no auto-resolution rules are active.
// The previous team_switch 3-game rule was removed since player team changes
// between games are expected (trades, 10-day contracts, etc.).

import type { MotherDuckConnection } from '../ingest/db/connection';

export interface AutoResolveResult {
  resolved: number;
}

export async function autoResolve(db: MotherDuckConnection): Promise<AutoResolveResult> {
  // Bulk-approve all remaining team_switch records from before this detector was removed.
  const legacy = await db.query<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM main.data_quality_quarantine
     WHERE detection_type = 'team_switch' AND resolution_status = 'pending'`,
  );
  const legacyCount = Number(legacy[0]?.cnt ?? 0);

  if (legacyCount > 0) {
    await db.execute(`
      UPDATE main.data_quality_quarantine
      SET resolution_status = 'approved',
          resolved_at = CURRENT_TIMESTAMP,
          resolved_by = 'auto-resolve:legacy-team-switch-cleanup'
      WHERE detection_type = 'team_switch'
        AND resolution_status = 'pending'
    `);
  }

  // No auto-resolution rules for wrong_team, impossible_stats, score_mismatch, or duplicate.
  // These require manual review.

  return { resolved: legacyCount };
}
