import { GET } from '../route';
import { queryDb } from '@/lib/db';
import { NextRequest } from 'next/server';
import { Schedule } from '@/types/schema';

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
    const mockDbResponse: Schedule[] = [
      {
        game_id: '202312180LAL',
        game_date: new Date('2023-12-18'),
        home_team_id: 1610612747, // Lakers team ID
        away_team_id: 1610612752, // Knicks team ID
        home_team_abbreviation: 'LAL',
        away_team_abbreviation: 'NYK',
        home_team_score: 115,
        away_team_score: 105,
        status: 'Final',
        created_at: new Date('2024-12-22T17:42:08-08:00')
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
    expect(data[0]).toEqual({
      game_id: '202312180LAL',
      game_date: mockDbResponse[0].game_date,
      home_team_id: 1610612747,
      away_team_id: 1610612752,
      home_team_abbreviation: 'LAL',
      away_team_abbreviation: 'NYK',
      home_team_score: 115,
      away_team_score: 105,
      status: 'Final',
      homeTeam: {
        teamId: 'LAL',
        teamName: 'LAL',
        teamAbbreviation: 'LAL',
        score: 115,
        players: []
      },
      awayTeam: {
        teamId: 'NYK',
        teamName: 'NYK',
        teamAbbreviation: 'NYK',
        score: 105,
        players: []
      },
      boxScoreLoaded: false
    });

    // Verify database was queried correctly
    expect(queryDb).toHaveBeenCalledWith('SELECT * FROM main.schedule');
  });

  it('should handle database errors', async () => {
    // Mock a database error
    const mockError = new Error('Database error');
    (queryDb as jest.Mock).mockRejectedValue(mockError);

    // Create a mock request object
    const mockRequest = new NextRequest('http://localhost:3000/api/schedule');

    // Call the API route handler with the mock request
    const response = await GET(mockRequest);
    const data = await response.json();

    // Check error response
    expect(data).toEqual({ error: 'Failed to fetch schedule' });
    expect(response.status).toBe(500);
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
