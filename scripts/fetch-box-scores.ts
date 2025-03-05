import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';

const DATA_DIR = '/Users/jacobmatson/code/nba-box-scores/nba-box-scores/data';
const SCHEDULE_DIR = path.join(DATA_DIR, 'schedule');
const BOX_SCORES_DIR = path.join(DATA_DIR, 'box_scores');

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Retry configuration
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 30000; // 30 seconds

/**
 * Makes an HTTP request with retry logic for non-200 responses
 * Uses exponential backoff for retries
 */
const fetchWithRetry = async (url: string, params: any, headers: any) => {
  let retries = 0;
  let delay = INITIAL_RETRY_DELAY;
  
  while (true) {
    try {
      const response = await axios.get(url, { params, headers });
      return response;
    } catch (err: any) {
      const status = err.response?.status;
      
      // If we've reached max retries or it's a 4xx error (except 429 rate limit), don't retry
      if (
        retries >= MAX_RETRIES || 
        (status && status >= 400 && status < 500 && status !== 429)
      ) {
        throw err;
      }
      
      // Calculate delay with exponential backoff
      // For 429 rate limit, use a longer delay
      if (status === 429) {
        delay = Math.min(delay * 3, MAX_RETRY_DELAY);
        console.log(`Rate limited (429), retrying in ${delay/1000} seconds... (Attempt ${retries + 1}/${MAX_RETRIES})`);
      } else {
        delay = Math.min(delay * 2, MAX_RETRY_DELAY);
        console.log(`Request failed with status ${status || 'unknown'}, retrying in ${delay/1000} seconds... (Attempt ${retries + 1}/${MAX_RETRIES})`);
      }
      
      // Wait before retrying
      await sleep(delay);
      retries++;
    }
  }
};

const backfillBoxScores = async () => {
  try {
    // Ensure box scores directory exists
    await fs.mkdir(BOX_SCORES_DIR, { recursive: true });
    console.log(`Box scores directory ready: ${BOX_SCORES_DIR}`);

    // Load completed games from file
    const completedGamesFile = path.join(SCHEDULE_DIR, 'completed-games.json');
    const completedGames = JSON.parse(await fs.readFile(completedGamesFile, 'utf-8'));
    
    // Filter out preseason games (starting with 001)
    const regularSeasonGames = completedGames.filter((game: { gameId: string }) => !game.gameId.startsWith('001'));
    console.log(`Found ${regularSeasonGames.length} regular season games out of ${completedGames.length} total games`);

    // Process each game
    for (const game of regularSeasonGames) {
      const gameId = game.gameId;
      const filePath = path.join(BOX_SCORES_DIR, `${gameId}.json`);
      
      // Skip if already exists
      try {
        await fs.access(filePath);
        console.log(`Skipping game ${gameId}: already exists`);
        continue;
      } catch {
        console.log(`Fetching box score for game ${gameId}...`);
      }

      try {
        // Add a small delay between requests
        await sleep(1000);

        const params = {
          GameId: gameId,
          Type: 'Player'
        };
        
        const headers = {
          'accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Origin': 'https://pbpstats.com',
          'Referer': 'https://pbpstats.com/'
        };
        
        // Use the retry function instead of direct axios call
        const response = await fetchWithRetry('https://api.pbpstats.com/get-game-stats', params, headers);

        if (!response.data) {
          console.error(`No data returned for game ${gameId}`);
          continue;
        }

        // Check if we have full game data
        if (!response.data.stats?.Home?.FullGame) {
          console.log(`Skipping game ${gameId}: full game data not yet available`);
          continue;
        }

        const data = {
          game,
          boxScore: response.data
        };

        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        console.log(`Saved box score for game ${gameId}: ${game.homeTeam.teamName} vs ${game.awayTeam.teamName}`);

      } catch (err: any) {
        console.error(`Error processing game ${gameId}:`, {
          message: err.message,
          status: err.response?.status,
          data: err.response?.data
        });

        // Even after retries, if we still have an error, wait before moving to the next game
        // This helps avoid cascading failures
        const waitTime = err.response?.status === 429 ? 15000 : 5000;
        console.log(`Moving to next game after error, waiting ${waitTime/1000} seconds...`);
        await sleep(waitTime);
      }
    }

  } catch (err) {
    console.error('Error in backfillBoxScores:', err);
    throw err;
  }
};

const main = async () => {
  try {
    await backfillBoxScores();
    console.log('Done!');
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
};

if (require.main === module) {
  main();
}
