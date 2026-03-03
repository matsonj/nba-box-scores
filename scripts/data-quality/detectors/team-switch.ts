// Detect players whose team_abbreviation changed from their most recent prior game.
// Idempotent: skips records already in quarantine.

import type { MotherDuckConnection } from '../../ingest/db/connection';
import type { Detector, DetectorResult } from '../types';

const DETECTION_TYPE = 'team_switch';

export const teamSwitchDetector: Detector = {
  name: DETECTION_TYPE,

  async run(db: MotherDuckConnection): Promise<DetectorResult> {
    // Find players whose team changed between consecutive FullGame appearances,
    // excluding any (game_id, entity_id, detection_type) already quarantined.
    const sql = `
      INSERT INTO main.data_quality_quarantine
        (game_id, entity_id, player_name, expected_team, actual_team, detection_type, details)
      SELECT
        curr.game_id,
        curr.entity_id,
        curr.player_name,
        prev.team_abbreviation AS expected_team,
        curr.team_abbreviation AS actual_team,
        '${DETECTION_TYPE}' AS detection_type,
        'Team changed from ' || prev.team_abbreviation || ' to ' || curr.team_abbreviation AS details
      FROM (
        SELECT
          bs.game_id, bs.entity_id, bs.player_name, bs.team_abbreviation,
          s.game_date,
          ROW_NUMBER() OVER (PARTITION BY bs.entity_id ORDER BY s.game_date DESC, bs.game_id DESC) AS rn
        FROM main.box_scores bs
        JOIN main.schedule s ON bs.game_id = s.game_id
        WHERE bs.period = 'FullGame'
      ) curr
      JOIN (
        SELECT
          bs.entity_id, bs.team_abbreviation,
          s.game_date,
          ROW_NUMBER() OVER (PARTITION BY bs.entity_id ORDER BY s.game_date DESC, bs.game_id DESC) AS rn
        FROM main.box_scores bs
        JOIN main.schedule s ON bs.game_id = s.game_id
        WHERE bs.period = 'FullGame'
      ) prev ON curr.entity_id = prev.entity_id AND prev.rn = curr.rn + 1
      WHERE curr.team_abbreviation != prev.team_abbreviation
        AND NOT EXISTS (
          SELECT 1 FROM main.data_quality_quarantine dqq
          WHERE dqq.game_id = curr.game_id
            AND dqq.entity_id = curr.entity_id
            AND dqq.detection_type = '${DETECTION_TYPE}'
        )
    `;

    // Count existing before insert
    const before = await db.query<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM main.data_quality_quarantine WHERE detection_type = '${DETECTION_TYPE}'`,
    );
    const beforeCount = before[0]?.cnt ?? 0;

    await db.execute(sql);

    const after = await db.query<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM main.data_quality_quarantine WHERE detection_type = '${DETECTION_TYPE}'`,
    );
    const afterCount = after[0]?.cnt ?? 0;

    const inserted = afterCount - beforeCount;

    return { name: DETECTION_TYPE, found: afterCount, inserted };
  },
};
