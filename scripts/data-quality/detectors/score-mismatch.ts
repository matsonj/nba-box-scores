// Detect games where the sum of individual player points does not match
// the team total from the schedule table.
// Idempotent: skips records already in quarantine.

import type { MotherDuckConnection } from '../../ingest/db/connection';
import type { Detector, DetectorOptions, DetectorResult } from '../types';

const DETECTION_TYPE = 'score_mismatch';

export const scoreMismatchDetector: Detector = {
  name: DETECTION_TYPE,

  async run(db: MotherDuckConnection, options?: DetectorOptions): Promise<DetectorResult> {
    const gameFilter = options?.incremental
      ? `AND bs.game_id IN (SELECT game_id FROM _unaudited_games)`
      : '';

    // Compare sum of player points per team per game against schedule scores.
    // entity_id is set to '0' (matching the team-aggregate convention in box_scores)
    // since this is a team-level check, not player-level.
    const sql = `
      INSERT INTO main.data_quality_quarantine
        (game_id, entity_id, player_name, expected_team, actual_team, detection_type, details)
      SELECT
        m.game_id,
        'TEAM_' || m.team_abbreviation AS entity_id,
        'TEAM' AS player_name,
        NULL AS expected_team,
        m.team_abbreviation AS actual_team,
        '${DETECTION_TYPE}' AS detection_type,
        'Player sum: ' || m.player_sum || ', Schedule score: ' || m.schedule_score AS details
      FROM (
        SELECT
          bs.game_id,
          bs.team_abbreviation,
          SUM(bs.points) AS player_sum,
          CASE
            WHEN bs.team_abbreviation = s.home_team_abbreviation THEN s.home_team_score
            ELSE s.away_team_score
          END AS schedule_score
        FROM main.box_scores bs
        JOIN main.schedule s ON bs.game_id = s.game_id
        WHERE bs.period = 'FullGame'
          ${gameFilter}
        GROUP BY bs.game_id, bs.team_abbreviation, s.home_team_abbreviation, s.away_team_abbreviation, s.home_team_score, s.away_team_score
      ) m
      WHERE m.player_sum != m.schedule_score
        AND NOT EXISTS (
          SELECT 1 FROM main.data_quality_quarantine dqq
          WHERE dqq.game_id = m.game_id
            AND dqq.actual_team = m.team_abbreviation
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
