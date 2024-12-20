import { GET } from '../route';
import { queryDb } from '@/lib/db';
import { NextRequest } from 'next/server';

// Mock the database query function
jest.mock('@/lib/db', () => ({
  queryDb: jest.fn(),
}));

// Mock NextResponse
jest.mock('next/server', () => ({
  NextRequest: jest.fn().mockImplementation((url) => ({
    url,
    method: 'GET'
  })),
  NextResponse: {
    json: jest.fn().mockImplementation((data, options) => ({
      json: async () => data,
      ...options
    })),
  },
}));

describe('Box Scores API Route', () => {
  const mockGameId = '0022400001';
  const mockRequest = new NextRequest('http://localhost:3000/api/box-scores/' + mockGameId);
  const mockParams = { params: { gameId: mockGameId } };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return complete box score data', async () => {
    // Mock player stats data
    const mockPlayerStats = [
      {
        game_id: mockGameId,
        team_id: 'BOS',
        entity_id: '1234',
        player_name: 'Player 1',
        minutes: '32:45',
        points: 20,
        rebounds: 5,
        assists: 6,
        steals: 2,
        blocks: 1,
        turnovers: 3,
        fg_made: 8,
        fg_attempted: 15,
        fg3_made: 2,
        fg3_attempted: 5,
        ft_made: 2,
        ft_attempted: 2,
        plus_minus: 10,
        starter: true,
        period: 'FullGame'
      }
    ];

    // Mock team stats data
    const mockTeamStats = [
      {
        team_id: 'BOS',
        points: 110,
        rebounds: 40,
        assists: 25,
        steals: 8,
        blocks: 5,
        turnovers: 12,
        fg_made: 40,
        fg_attempted: 85,
        fg3_made: 12,
        fg3_attempted: 35,
        ft_made: 18,
        ft_attempted: 20,
        game_id: mockGameId,
        period: 'FullGame'
      }
    ];

    // Mock game info
    const mockGameInfo = [
      {
        game_id: mockGameId,
        game_date: '2024-12-19',
        home_team_id: 'BOS',
        away_team_id: 'LAL',
        home_team_score: 110,
        away_team_score: 105,
        status: 'Final'
      }
    ];

    // Set up mock database responses in the same order as the route handler
    (queryDb as jest.Mock)
      .mockImplementation((query: string) => {
        if (query.includes('box_scores')) return mockPlayerStats;
        if (query.includes('team_stats')) return mockTeamStats;
        if (query.includes('schedule')) return mockGameInfo;
      });

    // Call the API route handler
    const response = await GET(mockRequest, mockParams);
    const data = await response.json();

    // Verify the response structure
    expect(data.gameInfo).toEqual({
      game_id: mockGameId,
      game_date: '2024-12-19',
      home_team_id: 'BOS',
      away_team_id: 'LAL',
      home_team_score: 110,
      away_team_score: 105,
      status: 'Final'
    });

    // Verify homeTeam structure
    expect(data.homeTeam).toEqual({
      teamId: 'BOS',
      teamName: 'BOS',
      teamAbbreviation: 'BOS',
      score: 110,
      players: mockPlayerStats,
      team_id: 'BOS',
      points: 110,
      rebounds: 40,
      assists: 25,
      steals: 8,
      blocks: 5,
      turnovers: 12,
      fg_made: 40,
      fg_attempted: 85,
      fg3_made: 12,
      fg3_attempted: 35,
      ft_made: 18,
      ft_attempted: 20,
      game_id: mockGameId,
      period: 'FullGame'
    });
  });

  it('should handle database errors', async () => {
    // Mock a database error
    (queryDb as jest.Mock).mockRejectedValue(new Error('Database error'));

    // Call the API route handler
    const response = await GET(mockRequest, mockParams);
    const data = await response.json();

    // Verify error response
    expect(data).toEqual({
      error: 'Error fetching box score'
    });
  });
});
