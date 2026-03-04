// Detect players whose team_abbreviation in box_scores doesn't match
// either team playing in the game according to the schedule.
// This catches upstream data issues where players are tagged to a team
// that isn't even in the game.
// Idempotent: skips records already in quarantine.

import type { MotherDuckConnection } from '../../ingest/db/connection';
import type { Detector, DetectorOptions, DetectorResult } from '../types';

const DETECTION_TYPE = 'wrong_team';

export const wrongTeamDetector: Detector = {
  name: DETECTION_TYPE,

  async run(db: MotherDuckConnection, options?: DetectorOptions): Promise<DetectorResult> {
    const gameFilter = options?.incremental
      ? `AND bs.game_id IN (SELECT game_id FROM _unaudited_games)`
      : '';

    const sql = `
      INSERT INTO main.data_quality_quarantine
        (game_id, entity_id, player_name, expected_team, actual_team, detection_type, details)
      SELECT
        bs.game_id,
        bs.entity_id,
        bs.player_name,
        s.home_team_abbreviation || '/' || s.away_team_abbreviation AS expected_team,
        bs.team_abbreviation AS actual_team,
        '${DETECTION_TYPE}' AS detection_type,
        'Player tagged as ' || bs.team_abbreviation || ' but game is ' || s.home_team_abbreviation || ' vs ' || s.away_team_abbreviation AS details
      FROM main.box_scores bs
      JOIN main.schedule s ON bs.game_id = s.game_id
      WHERE bs.period = 'FullGame'
        AND bs.team_abbreviation NOT IN (s.home_team_abbreviation, s.away_team_abbreviation)
        ${gameFilter}
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
    const beforeCount = Number(before[0]?.cnt ?? 0);

    await db.execute(sql);

    const after = await db.query<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM main.data_quality_quarantine WHERE detection_type = '${DETECTION_TYPE}'`,
    );
    const afterCount = Number(after[0]?.cnt ?? 0);

    return { name: DETECTION_TYPE, found: afterCount, inserted: afterCount - beforeCount };
  },
};
