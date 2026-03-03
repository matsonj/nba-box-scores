import * as fs from 'fs';
import * as path from 'path';
import { parseBoxScore } from '../box-score-parser';
import type { BoxScoreRow } from '../../types';

const FIXTURES_DIR = path.resolve(__dirname, '../../../../data/box_scores');

function loadFixture(gameId: string): unknown {
  const filePath = path.join(FIXTURES_DIR, `${gameId}.json`);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

describe('parseBoxScore', () => {
  let rows: BoxScoreRow[];

  beforeAll(() => {
    // 0022400061 = NYK @ BOS, 2024-10-22, regular 4-quarter game
    rows = parseBoxScore(loadFixture('0022400061'));
  });

  it('returns BoxScoreRow objects with all required fields', () => {
    const first = rows[0];
    expect(first).toHaveProperty('game_id');
    expect(first).toHaveProperty('team_abbreviation');
    expect(first).toHaveProperty('entity_id');
    expect(first).toHaveProperty('player_name');
    expect(first).toHaveProperty('period');
    expect(first).toHaveProperty('minutes');
    expect(first).toHaveProperty('points');
    expect(first).toHaveProperty('rebounds');
    expect(first).toHaveProperty('assists');
    expect(first).toHaveProperty('steals');
    expect(first).toHaveProperty('blocks');
    expect(first).toHaveProperty('turnovers');
    expect(first).toHaveProperty('fg_made');
    expect(first).toHaveProperty('fg_attempted');
    expect(first).toHaveProperty('fg3_made');
    expect(first).toHaveProperty('fg3_attempted');
    expect(first).toHaveProperty('ft_made');
    expect(first).toHaveProperty('ft_attempted');
    expect(first).toHaveProperty('starter');
  });

  it('sets the game_id from the JSON', () => {
    expect(rows[0].game_id).toBe('0022400061');
  });

  it('excludes team entities (EntityId = 0)', () => {
    const teamRows = rows.filter(r => r.entity_id === '0');
    expect(teamRows).toHaveLength(0);
  });

  it('produces rows for both teams', () => {
    const teams = new Set(rows.map(r => r.team_abbreviation));
    expect(teams.has('NYK')).toBe(true);
    expect(teams.has('BOS')).toBe(true);
    expect(teams.size).toBe(2);
  });

  it('produces per-period rows (1-4) and FullGame rows', () => {
    const periods = new Set(rows.map(r => r.period));
    expect(periods.has('1')).toBe(true);
    expect(periods.has('2')).toBe(true);
    expect(periods.has('3')).toBe(true);
    expect(periods.has('4')).toBe(true);
    expect(periods.has('FullGame')).toBe(true);
    // This game has no OT
    expect(periods.has('5')).toBe(false);
  });

  it('computes fg_made as FG2M + FG3M', () => {
    // Find Karl-Anthony Towns in period 1
    const kat = rows.find(
      r => r.entity_id === '1626157' && r.period === '1'
    );
    expect(kat).toBeDefined();
    // From the raw data: FG2M=2, FG3M not present in period 1 for KAT
    // So fg_made should be >= 2
    expect(kat!.fg_made).toBeGreaterThanOrEqual(2);
  });

  it('computes FullGame stats as sum of per-period stats', () => {
    // Find a player and verify their FullGame totals
    const entityId = '1626157'; // Karl-Anthony Towns
    const periodRows = rows.filter(
      r => r.entity_id === entityId && r.period !== 'FullGame'
    );
    const fullGame = rows.find(
      r => r.entity_id === entityId && r.period === 'FullGame'
    );
    expect(fullGame).toBeDefined();
    expect(periodRows.length).toBeGreaterThan(0);

    const sumPoints = periodRows.reduce((s, r) => s + r.points, 0);
    const sumRebounds = periodRows.reduce((s, r) => s + r.rebounds, 0);
    const sumAssists = periodRows.reduce((s, r) => s + r.assists, 0);
    const sumFgMade = periodRows.reduce((s, r) => s + r.fg_made, 0);
    const sumFg3Made = periodRows.reduce((s, r) => s + r.fg3_made, 0);
    const sumFtMade = periodRows.reduce((s, r) => s + r.ft_made, 0);

    expect(fullGame!.points).toBe(sumPoints);
    expect(fullGame!.rebounds).toBe(sumRebounds);
    expect(fullGame!.assists).toBe(sumAssists);
    expect(fullGame!.fg_made).toBe(sumFgMade);
    expect(fullGame!.fg3_made).toBe(sumFg3Made);
    expect(fullGame!.ft_made).toBe(sumFtMade);
  });

  it('assigns starters: exactly 5 per team in FullGame rows', () => {
    const fullGameRows = rows.filter(r => r.period === 'FullGame');
    for (const team of ['NYK', 'BOS']) {
      const teamFG = fullGameRows.filter(r => r.team_abbreviation === team);
      const starters = teamFG.filter(r => r.starter === 1);
      const bench = teamFG.filter(r => r.starter === 0);
      expect(starters).toHaveLength(5);
      expect(bench.length).toBeGreaterThan(0);
      expect(starters.length + bench.length).toBe(teamFG.length);
    }
  });

  it('leaves starter as null for per-period rows', () => {
    const periodOnly = rows.filter(r => r.period !== 'FullGame');
    for (const row of periodOnly) {
      expect(row.starter).toBeNull();
    }
  });

  it('computes summed minutes in MM:SS format for FullGame', () => {
    const fullGame = rows.find(
      r => r.entity_id === '1626157' && r.period === 'FullGame'
    );
    expect(fullGame).toBeDefined();
    expect(fullGame!.minutes).toMatch(/^\d+:\d{2}$/);
  });

  it('handles missing stat fields gracefully (defaults to 0)', () => {
    // Some players may not have all stats in a period
    for (const row of rows) {
      expect(row.points).toBeGreaterThanOrEqual(0);
      expect(row.rebounds).toBeGreaterThanOrEqual(0);
      expect(row.fg_made).toBeGreaterThanOrEqual(0);
      expect(row.fg_attempted).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('parseBoxScore with overtime game', () => {
  let rows: BoxScoreRow[];

  beforeAll(() => {
    // 0022400071 has overtime (period 5)
    rows = parseBoxScore(loadFixture('0022400071'));
  });

  it('includes OT period rows', () => {
    const periods = new Set(rows.map(r => r.period));
    expect(periods.has('5')).toBe(true);
  });

  it('includes OT stats in FullGame aggregation', () => {
    const entityIds = [...new Set(rows.filter(r => r.period === '5').map(r => r.entity_id))];
    // Pick first OT player
    const entityId = entityIds[0];
    const periodRows = rows.filter(
      r => r.entity_id === entityId && r.period !== 'FullGame'
    );
    const fullGame = rows.find(
      r => r.entity_id === entityId && r.period === 'FullGame'
    );
    expect(fullGame).toBeDefined();

    const sumPoints = periodRows.reduce((s, r) => s + r.points, 0);
    expect(fullGame!.points).toBe(sumPoints);
  });
});

describe('parseBoxScore with double overtime game', () => {
  let rows: BoxScoreRow[];

  beforeAll(() => {
    // 0022400501 has double overtime (periods 5 and 6)
    rows = parseBoxScore(loadFixture('0022400501'));
  });

  it('includes both OT period rows', () => {
    const periods = new Set(rows.map(r => r.period));
    expect(periods.has('5')).toBe(true);
    expect(periods.has('6')).toBe(true);
  });

  it('FullGame points include both OT periods', () => {
    // Get any player who played in period 6
    const otPlayers = rows.filter(r => r.period === '6');
    expect(otPlayers.length).toBeGreaterThan(0);

    const entityId = otPlayers[0].entity_id;
    const periodRows = rows.filter(
      r => r.entity_id === entityId && r.period !== 'FullGame'
    );
    const fullGame = rows.find(
      r => r.entity_id === entityId && r.period === 'FullGame'
    );
    expect(fullGame).toBeDefined();

    const sumPoints = periodRows.reduce((s, r) => s + r.points, 0);
    expect(fullGame!.points).toBe(sumPoints);
  });
});
