import { GET } from '../route';
import { queryDb } from '@/lib/db';
import { NextRequest, Request } from 'next/server';

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
  NextRequest: jest.fn().mockImplementation((request) => request),
}));

describe('Schedule API Route', () => {
  beforeEach(() => {
    // Clear mock data before each test
    jest.clearAllMocks();
  });

  it('should return transformed game data', async () => {
    // Mock data that would come from the database
    const mockDbResponse = [
      {
        game_id: '202312180LAL',
        game_date: '2023-12-18',
        home_team_abbreviation: 'LAL',
        away_team_abbreviation: 'NYK',
        home_team_score: 115,
        away_team_score: 105,
        status: 'Final'
      }
    ];

    // Set up the mock to return our test data
    (queryDb as jest.Mock).mockResolvedValue(mockDbResponse);

    // Create a mock request object
    const mockRequest = new NextRequest('http://localhost:3000/api/schedule');

    // Call the API route handler with the mock request
    const response = await GET(mockRequest);
    const data = await response.json();

    // Check the transformed data structure
    expect(data).toHaveLength(1);
    const game = data[0];
    
    // Test each property individually for better error messages
    expect(game.game_id).toBe('202312180LAL');
    expect(game.gameDate).toBe('2023-12-18');
    expect(game.homeTeam).toMatchObject({
      teamId: 'LAL',
      teamName: 'LAL',
      teamAbbreviation: 'LAL',
      score: 115,
      players: []
    });
    expect(game.awayTeam).toMatchObject({
      teamId: 'NYK',
      teamName: 'NYK',
      teamAbbreviation: 'NYK',
      score: 105,
      players: []
    });
    expect(game.status).toBe('Final');
    expect(game.boxScoreLoaded).toBe(false);
  });

  it('should handle database errors', async () => {
    // Mock a database error
    (queryDb as jest.Mock).mockRejectedValue(new Error('Database error'));

    // Create a mock request object
    const mockRequest = new NextRequest('http://localhost:3000/api/schedule');

    // Call the API route handler with the mock request
    const response = await GET(mockRequest);
    const data = await response.json();

    // Verify error response
    expect(data).toEqual({
      error: 'Error fetching schedule: Database error'
    });
  });

  it('should handle empty results', async () => {
    // Mock empty database response
    (queryDb as jest.Mock).mockResolvedValue([]);

    // Create a mock request object
    const mockRequest = new NextRequest('http://localhost:3000/api/schedule');

    // Call the API route handler with the mock request
    const response = await GET(mockRequest);
    const data = await response.json();

    // Verify empty array response
    expect(data).toEqual([]);
  });
});
