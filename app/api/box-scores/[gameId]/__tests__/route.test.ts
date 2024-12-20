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
  const mockGameId = '202312180LAL';
  const mockRequest = new NextRequest('http://localhost:3000/api/box-scores/' + mockGameId);
  const mockParams = { params: { gameId: mockGameId } };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return complete box score data', async () => {
    // Mock game info
    const mockGameInfo = [{
      game_id: '202312180LAL',
      game_date: '2023-12-18',
      home_team_abbreviation: 'LAL',
      away_team_abbreviation: 'NYK',
      home_team_score: 115,
      away_team_score: 105,
      status: 'Final'
    }];

    // Mock player stats data
    const mockPlayerStats = [{
      game_id: mockGameId,
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
    }];

    // Mock team stats data
    const mockTeamStats = [{
      game_id: mockGameId,
      team_abbreviation: 'LAL',
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
      points: 115,
      offensive_possessions: 100,
      defensive_possessions: 98,
      period: 'FullGame'
    }];

    // Set up mock database responses in the same order as the route handler
    (queryDb as jest.Mock)
      .mockResolvedValueOnce(mockPlayerStats)  // First query: player stats
      .mockResolvedValueOnce(mockTeamStats)    // Second query: team stats
      .mockResolvedValueOnce(mockGameInfo);    // Third query: game info

    // Call the API route handler
    const response = await GET(mockRequest, mockParams);
    const data = await response.json();

    // Verify the response structure
    expect(data.gameInfo).toEqual({
      game_id: mockGameId,
      game_date: undefined,
      gameDate: '2023-12-18',
      home_team_abbreviation: 'LAL',
      away_team_abbreviation: 'NYK',
      home_team_score: 115,
      away_team_score: 105,
      status: 'Final'
    });

    // Verify homeTeam structure
    expect(data.homeTeam).toEqual({
      teamId: 'LAL',
      teamName: 'LAL',
      teamAbbreviation: 'LAL',
      score: 115,
      players: [{
        game_id: mockGameId,
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
      }],
      game_id: mockGameId,
      team_abbreviation: 'LAL',
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
      points: 115,
      offensive_possessions: 100,
      defensive_possessions: 98,
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
