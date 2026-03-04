// Auto-resolution logic for quarantined records.
// Team switches are auto-approved when the player has 3+ games on the new team.

import type { MotherDuckConnection } from '../ingest/db/connection';

export interface AutoResolveResult {
  resolved: number;
}

export async function autoResolve(db: MotherDuckConnection): Promise<AutoResolveResult> {
  const before = await db.query<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM main.data_quality_quarantine
     WHERE detection_type = 'team_switch' AND resolution_status = 'pending'`,
  );
  const pendingBefore = before[0]?.cnt ?? 0;

  await db.execute(`
    UPDATE main.data_quality_quarantine
    SET resolution_status = 'approved',
        resolved_at = CURRENT_TIMESTAMP,
        resolved_by = 'auto-resolve:3-game-rule'
    WHERE detection_type = 'team_switch'
      AND resolution_status = 'pending'
      AND (entity_id, actual_team) IN (
        SELECT entity_id, actual_team FROM (
          SELECT dqq.entity_id, dqq.actual_team, COUNT(DISTINCT bs.game_id) AS cnt
          FROM main.data_quality_quarantine dqq
          JOIN main.box_scores bs
            ON dqq.entity_id = bs.entity_id AND bs.team_abbreviation = dqq.actual_team
          WHERE dqq.resolution_status = 'pending'
            AND dqq.detection_type = 'team_switch'
            AND bs.period = 'FullGame'
          GROUP BY dqq.entity_id, dqq.actual_team
        ) WHERE cnt >= 3
      )
  `);

  const after = await db.query<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM main.data_quality_quarantine
     WHERE detection_type = 'team_switch' AND resolution_status = 'pending'`,
  );
  const pendingAfter = after[0]?.cnt ?? 0;

  return { resolved: pendingBefore - pendingAfter };
}
