import { GET } from '../route';
import { queryDb } from '@/lib/db';
import { NextRequest } from 'next/server';
import { BoxScore, TeamStats, Schedule } from '@/types/schema';

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
    // Mock game info data
    const mockGameInfo: Schedule[] = [{
      game_id: mockGameId,
      game_date: new Date('2023-12-18'),
      home_team_id: 1610612738, // Celtics
      away_team_id: 1610612752, // Knicks
      home_team_abbreviation: 'BOS',
      away_team_abbreviation: 'NYK',
      home_team_score: 115,
      away_team_score: 105,
      status: 'Final',
      created_at: new Date()
    }];

    // Mock player stats data
    const mockPlayerStats: BoxScore[] = [
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
      },
      {
        game_id: mockGameId,
        team_id: 'NYK',
        entity_id: '5678',
        player_name: 'Player 2',
        minutes: '28:15',
        points: 15,
        rebounds: 8,
        assists: 3,
        steals: 1,
        blocks: 2,
        turnovers: 2,
        fg_made: 6,
        fg_attempted: 12,
        fg3_made: 1,
        fg3_attempted: 4,
        ft_made: 2,
        ft_attempted: 3,
        plus_minus: -5,
        starter: true,
        period: 'FullGame'
      }
    ];

    // Mock team stats data
    const mockTeamStats: TeamStats[] = [
      {
        game_id: mockGameId,
        team_id: 'BOS',
        period: 'FullGame',
        minutes: '240:00',
        points: 110,
        rebounds: 45,
        assists: 25,
        steals: 8,
        blocks: 5,
        turnovers: 12,
        fg_made: 42,
        fg_attempted: 85,
        fg3_made: 12,
        fg3_attempted: 32,
        ft_made: 14,
        ft_attempted: 18,
        plus_minus: 8
      },
      {
        game_id: mockGameId,
        team_id: 'NYK',
        period: 'FullGame',
        minutes: '240:00',
        points: 102,
        rebounds: 40,
        assists: 20,
        steals: 6,
        blocks: 4,
        turnovers: 15,
        fg_made: 38,
        fg_attempted: 82,
        fg3_made: 10,
        fg3_attempted: 28,
        ft_made: 16,
        ft_attempted: 20,
        plus_minus: -8
      }
    ];

    // Set up mock responses
    (queryDb as jest.Mock)
      .mockResolvedValueOnce(mockGameInfo)
      .mockResolvedValueOnce(mockPlayerStats)
      .mockResolvedValueOnce(mockTeamStats);

    // Call the API route handler
    const response = await GET(mockRequest, mockParams);
    const data = await response.json();

    // Verify the response structure
    expect(data.teams).toHaveLength(2);
    
    // Check Boston team data
    const bostonTeam = data.teams.find((team: any) => team.teamId === 'BOS');
    expect(bostonTeam).toBeDefined();
    expect(bostonTeam.players).toHaveLength(1);
    expect(bostonTeam.players[0]).toMatchObject({
      playerId: '1234',
      playerName: 'Player 1',
      minutes: '32:45',
      points: 20,
      rebounds: 5,
      assists: 6
    });

    // Check game info
    expect(data.gameInfo).toMatchObject({
      game_id: mockGameId,
      home_team_abbreviation: 'BOS',
      away_team_abbreviation: 'NYK',
      home_team_score: 115,
      away_team_score: 105,
      status: 'Final'
    });
  });

  it('should handle database errors', async () => {
    // Mock a database error
    const mockError = new Error('Database error');
    (queryDb as jest.Mock).mockRejectedValue(mockError);

    // Call the API route handler
    const response = await GET(mockRequest, mockParams);
    const data = await response.json();

    // Check error response
    expect(data).toEqual({ error: 'Internal server error' });
    expect(response.status).toBe(500);
  });

  it('should handle game not found', async () => {
    // Mock empty game info response
    (queryDb as jest.Mock).mockResolvedValueOnce([]);

    const response = await GET(mockRequest, mockParams);
    const data = await response.json();

    expect(data).toEqual({ error: 'Game not found' });
    expect(response.status).toBe(404);
  });
});
