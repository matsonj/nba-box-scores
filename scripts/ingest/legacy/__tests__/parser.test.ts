import {
  parsePlayerRows,
  parseGames,
  formatMinutes,
  normalizeTeamTricode,
  legacyGameId,
} from '../parser';
import { FEATURES, type ImputationModels, type ImputableStat } from '../imputer';
import type { NormalizedPlayerRow, NormalizedGameRow } from '../types';

// Constant-rate models (feature coefs 0 → predicted per-36 rate == intercept),
// so imputed values are deterministic regardless of the player's profile.
const constModel = (target: ImputableStat, intercept: number) => ({
  target,
  coefficients: [intercept, ...new Array(FEATURES.length).fill(0)],
  r2: 0.2,
  nTrain: 100,
});
const MODELS: ImputationModels = {
  steals: constModel('steals', 1.8),
  blocks: constModel('blocks', 0.9),
  turnovers: constModel('turnovers', 2.4),
};

function makeRow(p: Partial<NormalizedPlayerRow> & { season_year: number }): NormalizedPlayerRow {
  return {
    source_game_id: '100',
    game_date: `${p.season_year}-12-01`,
    person_id: 'pid-1',
    player_name: 'Test Player',
    team: 'Lakers',
    is_home: true,
    is_starter: null,
    minutes: 36,
    points: 20,
    rebounds: 8,
    assists: 5,
    steals: null,
    blocks: null,
    turnovers: null,
    fg_made: 8,
    fg_attempted: 15,
    fg3_made: null,
    fg3_attempted: null,
    ft_made: 4,
    ft_attempted: 5,
    fouls: 2,
    height: 78,
    age: 27,
    pos_guard: 1,
    pos_forward: 0,
    pos_center: 0,
    ...p,
  };
}

describe('parsePlayerRows — era handling', () => {
  it('1968: imputes steals/blocks/turnovers and zeroes 3PT structurally', () => {
    const [row] = parsePlayerRows(
      [makeRow({ season_year: 1968, fg3_made: 9, fg3_attempted: 9 })], // bogus 3PT must be ignored
      MODELS,
    );
    expect(row.steals).toBe(2); // round(1.8 * 36/36)
    expect(row.blocks).toBe(1); // round(0.9)
    expect(row.turnovers).toBe(2); // round(2.4)
    expect(row.fg3_made).toBe(0);
    expect(row.fg3_attempted).toBe(0);
    expect(row.estimated_stats).toBe('steals,blocks,turnovers');
    expect(row.period).toBe('FullGame');
  });

  it('1975: keeps real steals/blocks, imputes only turnovers, 3PT still structural 0', () => {
    const [row] = parsePlayerRows(
      [makeRow({ season_year: 1975, steals: 3, blocks: 1, fg3_made: 1, fg3_attempted: 2 })],
      MODELS,
    );
    expect(row.steals).toBe(3);
    expect(row.blocks).toBe(1);
    expect(row.turnovers).toBe(2); // imputed
    expect(row.fg3_made).toBe(0);
    expect(row.estimated_stats).toBe('turnovers');
  });

  it('1985: everything real, 3PT recorded, nothing flagged', () => {
    const [row] = parsePlayerRows(
      [makeRow({ season_year: 1985, steals: 2, blocks: 1, turnovers: 3, fg3_made: 2, fg3_attempted: 5 })],
      MODELS,
    );
    expect(row.steals).toBe(2);
    expect(row.blocks).toBe(1);
    expect(row.turnovers).toBe(3);
    expect(row.fg3_made).toBe(2);
    expect(row.fg3_attempted).toBe(5);
    expect(row.estimated_stats).toBeNull();
  });

  it('leaves the stat NULL (unflagged) when minutes are missing', () => {
    const [row] = parsePlayerRows([makeRow({ season_year: 1968, minutes: null })], MODELS);
    expect(row.steals).toBeNull();
    expect(row.estimated_stats).toBeNull();
  });
});

describe('parsePlayerRows — starter heuristic', () => {
  it('marks the top-5 scorers per team as starters', () => {
    const team = [30, 20, 15, 10, 5, 2].map((pts, i) =>
      makeRow({
        season_year: 1985,
        person_id: `pid-${i}`,
        player_name: `Player ${i}`,
        points: pts,
        steals: 1,
        blocks: 0,
        turnovers: 1,
      }),
    );
    const rows = parsePlayerRows(team, MODELS);
    const starters = rows.filter((r) => r.starter === 1);
    const benched = rows.filter((r) => r.starter === 0);
    expect(starters).toHaveLength(5);
    expect(benched).toHaveLength(1);
    expect(benched[0].player_name).toBe('Player 5'); // the 2-point scorer
  });

  it('trusts source startingPosition when present (no heuristic)', () => {
    // Low scorer is flagged a starter by the source; a high scorer is not.
    const team = [
      makeRow({ season_year: 1985, person_id: 'a', player_name: 'High', points: 30, is_starter: null, steals: 1, blocks: 0, turnovers: 1 }),
      makeRow({ season_year: 1985, person_id: 'b', player_name: 'StarterLow', points: 4, is_starter: true, steals: 1, blocks: 0, turnovers: 1 }),
    ];
    const rows = parsePlayerRows(team, MODELS);
    const high = rows.find((r) => r.player_name === 'High')!;
    const low = rows.find((r) => r.player_name === 'StarterLow')!;
    expect(low.starter).toBe(1); // source said starter
    expect(high.starter).toBe(0); // not flagged → bench, despite scoring more
  });
});

describe('helpers', () => {
  it('prefixes legacy game ids', () => {
    expect(legacyGameId('194611010BOS')).toBe('L194611010BOS');
  });

  it('formats decimal minutes as M:SS', () => {
    expect(formatMinutes(35.5)).toBe('35:30');
    expect(formatMinutes(0)).toBe('0:00');
    expect(formatMinutes(null)).toBe('0:00');
    expect(formatMinutes(12)).toBe('12:00');
  });

  it('normalizes team names to tricodes', () => {
    expect(normalizeTeamTricode('Lakers')).toBe('LAL');
    expect(normalizeTeamTricode('Minneapolis Lakers')).toBe('LAL');
    expect(normalizeTeamTricode('BOS')).toBe('BOS');
  });

  it('parseGames prefixes ids and defaults status to Final', () => {
    const games: NormalizedGameRow[] = [
      {
        source_game_id: '100',
        game_date: '1968-12-01',
        season_year: 1968,
        season_type: 'Regular Season',
        home_team: 'Celtics',
        away_team: 'Lakers',
        home_team_id: null,
        away_team_id: null,
        home_score: 110,
        away_score: 105,
      },
    ];
    const [s] = parseGames(games);
    expect(s.game_id).toBe('L100');
    expect(s.home_team_abbreviation).toBe('BOS');
    expect(s.away_team_abbreviation).toBe('LAL');
    expect(s.game_status).toBe('Final');
    expect(s.home_team_id).toBeGreaterThan(0); // synthesized, non-null
  });
});
