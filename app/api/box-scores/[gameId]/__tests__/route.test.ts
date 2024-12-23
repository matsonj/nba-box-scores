import { GET } from '../route';
import { queryDb } from '@/lib/db';
import { NextRequest } from 'next/server';
import { BoxScore, TeamStats } from '@/types/schema';

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

    // Set up the mock to return our test data
    (queryDb as jest.Mock)
      .mockImplementation((query: string) => {
        if (query.includes('box_scores')) {
          return Promise.resolve(mockPlayerStats);
        } else if (query.includes('team_stats')) {
          return Promise.resolve(mockTeamStats);
        }
      });

    // Call the API route handler
    const response = await GET(mockRequest, mockParams);
    const data = await response.json();

    // Verify the response structure
    expect(data).toHaveLength(2);
    
    // Check Boston team data
    const bostonTeam = data.find((team: any) => team.teamId === 'BOS');
    expect(bostonTeam).toBeDefined();
    expect(bostonTeam.score).toBe(110);
    expect(bostonTeam.players).toHaveLength(1);
    expect(bostonTeam.players[0]).toEqual({
      playerId: '1234',
      playerName: 'Player 1',
      minutes: '32:45',
      points: 20,
      rebounds: 5,
      assists: 6,
      steals: 2,
      blocks: 1,
      turnovers: 3,
      fgMade: 8,
      fgAttempted: 15,
      fg3Made: 2,
      fg3Attempted: 5,
      ftMade: 2,
      ftAttempted: 2,
      plusMinus: 10,
      starter: true
    });

    // Check Knicks team data
    const knicksTeam = data.find((team: any) => team.teamId === 'NYK');
    expect(knicksTeam).toBeDefined();
    expect(knicksTeam.score).toBe(102);
    expect(knicksTeam.players).toHaveLength(1);
    expect(knicksTeam.players[0]).toEqual({
      playerId: '5678',
      playerName: 'Player 2',
      minutes: '28:15',
      points: 15,
      rebounds: 8,
      assists: 3,
      steals: 1,
      blocks: 2,
      turnovers: 2,
      fgMade: 6,
      fgAttempted: 12,
      fg3Made: 1,
      fg3Attempted: 4,
      ftMade: 2,
      ftAttempted: 3,
      plusMinus: -5,
      starter: true
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
    expect(data).toEqual({ error: 'Failed to fetch box score' });
    expect(response.status).toBe(500);
  });
});
