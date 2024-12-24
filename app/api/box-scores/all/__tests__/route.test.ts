import { GET } from '../route';
import { queryDb } from '@/lib/db';
import { TeamStats } from '@/types/schema';

// Mock the database query function
jest.mock('@/lib/db', () => ({
  queryDb: jest.fn(),
}));

// Mock NextResponse
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn().mockImplementation((data, options) => ({
      json: async () => data,
      ...options
    })),
  },
}));

describe('Box Scores All API Route', () => {
  beforeEach(() => {
    // Clear mock data before each test
    jest.clearAllMocks();
  });

  it('should return period scores grouped by game', async () => {
    // Mock data that would come from the database
    const mockDbResponse: TeamStats[] = [
      {
        game_id: '202312180LAL',
        team_id: '1610612747', // Lakers
        period: '1',
        minutes: '12:00',
        points: 28,
        rebounds: 10,
        assists: 8,
        steals: 2,
        blocks: 1,
        turnovers: 3,
        fg_made: 11,
        fg_attempted: 22,
        fg3_made: 3,
        fg3_attempted: 8,
        ft_made: 3,
        ft_attempted: 4,
        offensive_possessions: 24,
        defensive_possessions: 23
      },
      {
        game_id: '202312180LAL',
        team_id: '1610612752', // Knicks
        period: '1',
        minutes: '12:00',
        points: 25,
        rebounds: 12,
        assists: 6,
        steals: 1,
        blocks: 2,
        turnovers: 4,
        fg_made: 10,
        fg_attempted: 24,
        fg3_made: 2,
        fg3_attempted: 7,
        ft_made: 3,
        ft_attempted: 3,
        offensive_possessions: 23,
        defensive_possessions: 24
      }
    ];

    // Set up the mock to return our test data
    (queryDb as jest.Mock).mockResolvedValue(mockDbResponse);

    // Call the API route handler
    const response = await GET();
    const data = await response.json();

    // Verify the response structure
    expect(data).toEqual({
      '202312180LAL': [
        {
          teamId: 1610612747,
          period: '1',
          points: 28
        },
        {
          teamId: 1610612752,
          period: '1',
          points: 25
        }
      ]
    });

    // Verify that queryDb was called with the correct SQL
    expect(queryDb).toHaveBeenCalledWith(
      `SELECT game_id, team_id, period, points 
       FROM main.team_stats 
       WHERE period != 'FullGame'
       ORDER BY game_id, team_id, CAST(period AS INTEGER)`
    );
  });

  it('should handle empty results', async () => {
    // Mock empty database response
    (queryDb as jest.Mock).mockResolvedValue([]);

    // Call the API route handler
    const response = await GET();
    const data = await response.json();

    // Verify empty response
    expect(data).toEqual({});
  });

  it('should handle database errors', async () => {
    // Mock database error
    (queryDb as jest.Mock).mockRejectedValue(new Error('Database error'));

    // Call the API route handler
    const response = await GET();
    const data = await response.json();

    // Verify error response
    expect(data).toEqual({ error: 'Internal server error' });
    expect(response.status).toBe(500);
  });
});
