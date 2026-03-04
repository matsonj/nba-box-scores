// Detect duplicate (game_id, entity_id, period) entries in box_scores.
// Should be prevented by PRIMARY KEY but worth checking as a safety net.
// Idempotent: skips records already in quarantine.

import type { MotherDuckConnection } from '../../ingest/db/connection';
import type { Detector, DetectorOptions, DetectorResult } from '../types';

const DETECTION_TYPE = 'duplicate';

export const duplicatesDetector: Detector = {
  name: DETECTION_TYPE,

  async run(db: MotherDuckConnection, options?: DetectorOptions): Promise<DetectorResult> {
    const gameFilter = options?.incremental
      ? `WHERE game_id IN (SELECT game_id FROM _unaudited_games)`
      : '';

    const sql = `
      INSERT INTO main.data_quality_quarantine
        (game_id, entity_id, player_name, expected_team, actual_team, detection_type, details)
      SELECT
        d.game_id,
        d.entity_id,
        d.player_name,
        NULL AS expected_team,
        d.team_abbreviation AS actual_team,
        '${DETECTION_TYPE}' AS detection_type,
        'Duplicate count: ' || d.cnt || ' for period ' || d.period AS details
      FROM (
        SELECT
          game_id, entity_id, period, team_abbreviation, player_name,
          COUNT(*) AS cnt
        FROM main.box_scores
        ${gameFilter}
        GROUP BY game_id, entity_id, period, team_abbreviation, player_name
        HAVING COUNT(*) > 1
      ) d
      WHERE NOT EXISTS (
        SELECT 1 FROM main.data_quality_quarantine dqq
        WHERE dqq.game_id = d.game_id
          AND dqq.entity_id = d.entity_id
          AND dqq.detection_type = '${DETECTION_TYPE}'
      )
    `;

    const before = await db.query<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM main.data_quality_quarantine WHERE detection_type = '${DETECTION_TYPE}'`,
    );
    const beforeCount = Number(before[0]?.cnt ?? 0);

    await db.execute(sql);

    const after = await db.query<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM main.data_quality_quarantine WHERE detection_type = '${DETECTION_TYPE}'`,
    );
    const afterCount = Number(after[0]?.cnt ?? 0);

    return { name: DETECTION_TYPE, found: afterCount, inserted: afterCount - beforeCount };
  },
};
