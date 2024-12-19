import { getConnection, queryDb } from '../db';
import path from 'path';
import fs from 'fs';

describe('Database Connection', () => {
  beforeAll(() => {
    // Ensure the data directory exists
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  });

  it('should connect to the database', async () => {
    const conn = await getConnection();
    expect(conn).toBeDefined();
  });

  it('should execute a simple query', async () => {
    const result = await queryDb('SELECT 1 as value');
    expect(result).toEqual([{ value: 1 }]);
  });

  it('should execute a prepared statement with string parameter', async () => {
    const result = await queryDb<{ value: string }>(
      'SELECT $1 as value',
      ['test']
    );
    expect(result).toEqual([{ value: 'test' }]);
  });

  it('should execute a prepared statement with integer parameter', async () => {
    const result = await queryDb<{ value: number }>(
      'SELECT $1 as value',
      [42]
    );
    expect(result).toEqual([{ value: 42 }]);
  });

  it('should execute a prepared statement with multiple parameters', async () => {
    const result = await queryDb<{ str: string; num: number }>(
      'SELECT $1 as str, $2 as num',
      ['test', 42]
    );
    expect(result).toEqual([{ str: 'test', num: 42 }]);
  });

  it('should execute a prepared statement with date parameter', async () => {
    const testDate = new Date('2024-01-01');
    const result = await queryDb<{ value: Date }>(
      'SELECT $1::DATE as value',
      [testDate]
    );
    expect(result[0].value).toBeInstanceOf(Date);
  });

  it('should handle errors gracefully', async () => {
    await expect(queryDb('SELECT * FROM nonexistent_table'))
      .rejects
      .toThrow();
  });

  it('should query the NBA schedule table', async () => {
    const result = await queryDb(
      'SELECT * FROM main.schedule LIMIT 1'
    );
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty('game_id');
      expect(result[0]).toHaveProperty('game_date');
      expect(result[0]).toHaveProperty('home_team');
      expect(result[0]).toHaveProperty('away_team');
    }
  });

  it('should query the NBA box scores table with parameters', async () => {
    // First get a game_id from the schedule
    const scheduleResult = await queryDb(
      'SELECT game_id FROM main.schedule LIMIT 1'
    );
    
    if (scheduleResult.length > 0) {
      const gameId = scheduleResult[0].game_id;
      const result = await queryDb(
        'SELECT * FROM main.box_scores WHERE game_id = $1',
        [gameId]
      );
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('game_id', gameId);
        expect(result[0]).toHaveProperty('player_name');
        expect(result[0]).toHaveProperty('team_abbreviation');
        expect(result[0]).toHaveProperty('minutes');
        expect(result[0]).toHaveProperty('points');
      }
    }
  });
});
