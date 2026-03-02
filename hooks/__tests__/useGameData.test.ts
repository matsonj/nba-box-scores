import { renderHook } from '@testing-library/react';
import { useSchedule, useBoxScores } from '../useGameData';

const mockEvaluateQuery = jest.fn();
const mockLoadEssentialTables = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/MotherDuckContext', () => ({
  useMotherDuckClientState: () => ({
    evaluateQuery: mockEvaluateQuery,
  }),
}));

jest.mock('@/lib/dataLoader', () => ({
  useDataLoader: () => ({
    loadEssentialTables: mockLoadEssentialTables,
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useSchedule', () => {
  it('returns a fetchSchedule function', () => {
    const { result } = renderHook(() => useSchedule());
    expect(typeof result.current.fetchSchedule).toBe('function');
  });

  it('fetchSchedule loads essential tables then queries schedule', async () => {
    const mockRows = [
      {
        game_id: '0022400100',
        game_date: '2024-11-01T00:00:00',
        home_team_id: 1610612747,
        away_team_id: 1610612738,
        home_team_abbreviation: 'LAL',
        away_team_abbreviation: 'BOS',
        home_team_score: 110,
        away_team_score: 105,
        status: 'Final',
        created_at: '2024-11-02T00:00:00',
      },
    ];

    mockEvaluateQuery.mockResolvedValueOnce({
      data: { toRows: () => mockRows },
    });

    const { result } = renderHook(() => useSchedule());
    const schedule = await result.current.fetchSchedule();

    expect(mockLoadEssentialTables).toHaveBeenCalledTimes(1);
    expect(mockEvaluateQuery).toHaveBeenCalledTimes(1);
    expect(mockEvaluateQuery.mock.calls[0][0]).toContain('schedule');

    expect(schedule).toHaveLength(1);
    expect(schedule[0].game_id).toBe('0022400100');
    expect(schedule[0].home_team).toBe('Los Angeles Lakers');
    expect(schedule[0].away_team).toBe('Boston Celtics');
    expect(schedule[0].home_team_abbreviation).toBe('LAL');
    expect(schedule[0].away_team_abbreviation).toBe('BOS');
    expect(schedule[0].home_team_score).toBe(110);
    expect(schedule[0].away_team_score).toBe(105);
    expect(schedule[0].game_date).toBeInstanceOf(Date);
  });

  it('fetchSchedule propagates errors', async () => {
    mockEvaluateQuery.mockRejectedValueOnce(new Error('Connection lost'));

    const { result } = renderHook(() => useSchedule());
    await expect(result.current.fetchSchedule()).rejects.toThrow('Connection lost');
  });
});

describe('useBoxScores', () => {
  it('returns a fetchBoxScores function', () => {
    const { result } = renderHook(() => useBoxScores());
    expect(typeof result.current.fetchBoxScores).toBe('function');
  });

  it('fetchBoxScores groups period scores by game_id', async () => {
    const mockRows = [
      { game_id: 'G1', team_id: 'LAL', period: '1', points: 25 },
      { game_id: 'G1', team_id: 'LAL', period: '2', points: 30 },
      { game_id: 'G1', team_id: 'BOS', period: '1', points: 28 },
      { game_id: 'G2', team_id: 'GSW', period: '1', points: 32 },
    ];

    mockEvaluateQuery.mockResolvedValueOnce({
      data: { toRows: () => mockRows },
    });

    const { result } = renderHook(() => useBoxScores());
    const scores = await result.current.fetchBoxScores();

    expect(mockLoadEssentialTables).toHaveBeenCalledTimes(1);

    // G1 should have 3 entries
    expect(scores['G1']).toHaveLength(3);
    expect(scores['G1'][0]).toEqual({ teamId: 'LAL', period: '1', points: 25 });
    expect(scores['G1'][1]).toEqual({ teamId: 'LAL', period: '2', points: 30 });
    expect(scores['G1'][2]).toEqual({ teamId: 'BOS', period: '1', points: 28 });

    // G2 should have 1 entry
    expect(scores['G2']).toHaveLength(1);
    expect(scores['G2'][0]).toEqual({ teamId: 'GSW', period: '1', points: 32 });
  });

  it('fetchBoxScores returns empty object when no scores exist', async () => {
    mockEvaluateQuery.mockResolvedValueOnce({
      data: { toRows: () => [] },
    });

    const { result } = renderHook(() => useBoxScores());
    const scores = await result.current.fetchBoxScores();

    expect(scores).toEqual({});
  });

  it('fetchBoxScores converts points to numbers', async () => {
    const mockRows = [
      { game_id: 'G1', team_id: 'LAL', period: '1', points: '25' },
    ];

    mockEvaluateQuery.mockResolvedValueOnce({
      data: { toRows: () => mockRows },
    });

    const { result } = renderHook(() => useBoxScores());
    const scores = await result.current.fetchBoxScores();

    expect(scores['G1'][0].points).toBe(25);
    expect(typeof scores['G1'][0].points).toBe('number');
  });

  it('fetchBoxScores propagates errors', async () => {
    mockEvaluateQuery.mockRejectedValueOnce(new Error('Query timeout'));

    const { result } = renderHook(() => useBoxScores());
    await expect(result.current.fetchBoxScores()).rejects.toThrow('Query timeout');
  });
});
