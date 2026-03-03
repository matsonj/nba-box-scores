// Detect box score rows with impossibly high stat values.
// Thresholds above any realistic NBA performance.
// Idempotent: skips records already in quarantine.

import type { MotherDuckConnection } from '../../ingest/db/connection';
import type { Detector, DetectorResult } from '../types';

const DETECTION_TYPE = 'impossible_stats';

export const impossibleStatsDetector: Detector = {
  name: DETECTION_TYPE,

  async run(db: MotherDuckConnection): Promise<DetectorResult> {
    const sql = `
      INSERT INTO main.data_quality_quarantine
        (game_id, entity_id, player_name, expected_team, actual_team, detection_type, details)
      SELECT
        bs.game_id,
        bs.entity_id,
        bs.player_name,
        NULL AS expected_team,
        bs.team_id AS actual_team,
        '${DETECTION_TYPE}' AS detection_type,
        CASE
          WHEN bs.points > 82 THEN 'Points: ' || bs.points
          WHEN bs.rebounds > 30 THEN 'Rebounds: ' || bs.rebounds
          WHEN bs.assists > 30 THEN 'Assists: ' || bs.assists
          WHEN bs.steals > 15 THEN 'Steals: ' || bs.steals
          WHEN bs.blocks > 15 THEN 'Blocks: ' || bs.blocks
          ELSE 'Unknown threshold exceeded'
        END AS details
      FROM main.box_scores bs
      WHERE bs.period = 'FullGame'
        AND (bs.points > 82 OR bs.rebounds > 30 OR bs.assists > 30 OR bs.steals > 15 OR bs.blocks > 15)
        AND NOT EXISTS (
          SELECT 1 FROM main.data_quality_quarantine dqq
          WHERE dqq.game_id = bs.game_id
            AND dqq.entity_id = bs.entity_id
            AND dqq.detection_type = '${DETECTION_TYPE}'
        )
    `;

    const before = await db.query<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM main.data_quality_quarantine WHERE detection_type = '${DETECTION_TYPE}'`,
    );
    const beforeCount = before[0]?.cnt ?? 0;

    await db.execute(sql);

    const after = await db.query<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM main.data_quality_quarantine WHERE detection_type = '${DETECTION_TYPE}'`,
    );
    const afterCount = after[0]?.cnt ?? 0;

    return { name: DETECTION_TYPE, found: afterCount, inserted: afterCount - beforeCount };
  },
};
