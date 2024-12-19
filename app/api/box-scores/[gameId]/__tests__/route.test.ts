import { GET } from '../route';
import { queryDb } from '@/lib/db';

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

describe('Box Scores API Route', () => {
  const mockGameId = '202312180LAL';
  const mockRequest = {} as Request;
  const mockParams = { params: { gameId: mockGameId } };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return complete box score data', async () => {
    // Mock player stats data
    const mockPlayerStats = [
      {
        player_name: 'LeBron James',
        team_abbreviation: 'LAL',
        minutes: 35,
        field_goals_made: 10,
        field_goals_attempted: 20,
        three_pointers_made: 2,
        three_pointers_attempted: 5,
        free_throws_made: 5,
        free_throws_attempted: 6,
        offensive_rebounds: 2,
        defensive_rebounds: 8,
        rebounds: 10,
        assists: 8,
        steals: 2,
        blocks: 1,
        turnovers: 3,
        personal_fouls: 2,
        points: 27,
        period: 'FullGame'
      }
    ];

    // Mock team stats data
    const mockTeamStats = [
      {
        team_abbreviation: 'LAL',
        points: 115,
        field_goals_made: 42,
        field_goals_attempted: 85,
        three_pointers_made: 12,
        three_pointers_attempted: 30,
        free_throws_made: 19,
        free_throws_attempted: 25,
        offensive_rebounds: 10,
        defensive_rebounds: 35,
        rebounds: 45,
        assists: 25,
        steals: 8,
        blocks: 5,
        turnovers: 12,
        personal_fouls: 18,
        offensive_possessions: 100,
        defensive_possessions: 98,
        period: 'FullGame'
      }
    ];

    // Mock game info data
    const mockGameInfo = [
      {
        game_id: mockGameId,
        game_date: '2023-12-18',
        home_team_abbreviation: 'LAL',
        away_team_abbreviation: 'NYK',
        home_team_score: 115,
        away_team_score: 105,
        status: 'Final'
      }
    ];

    // Set up query mock to return different data based on the query
    (queryDb as jest.Mock).mockImplementation((query: string) => {
      if (query.includes('FROM main.box_scores')) {
        return Promise.resolve(mockPlayerStats);
      }
      if (query.includes('FROM main.team_stats')) {
        return Promise.resolve(mockTeamStats);
      }
      if (query.includes('FROM main.schedule')) {
        return Promise.resolve(mockGameInfo);
      }
      return Promise.resolve([]);
    });

    // Call the API route handler
    const response = await GET(mockRequest, mockParams);
    const data = await response.json();

    // Verify the response structure
    expect(data).toMatchObject({
      gameInfo: mockGameInfo[0],
      playerStats: mockPlayerStats,
      teamStats: mockTeamStats
    });

    // Verify database queries were called with correct game ID
    expect(queryDb).toHaveBeenCalledTimes(3);
    expect(queryDb).toHaveBeenCalledWith(expect.any(String), [mockGameId]);
  });

  it('should handle game not found', async () => {
    // Mock empty game info response
    (queryDb as jest.Mock).mockImplementation((query: string) => {
      if (query.includes('FROM main.schedule')) {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    // Call the API route handler
    const response = await GET(mockRequest, mockParams);
    const data = await response.json();

    // Verify error response
    expect(data).toMatchObject({
      error: 'Game not found'
    });
    expect(response.status).toBe(404);
  });

  it('should handle database errors', async () => {
    // Mock database error
    (queryDb as jest.Mock).mockRejectedValue(new Error('Database error'));

    // Call the API route handler
    const response = await GET(mockRequest, mockParams);
    const data = await response.json();

    // Verify error response
    expect(data).toMatchObject({
      error: 'Error fetching box score'
    });
    expect(response.status).toBe(500);
  });
});
