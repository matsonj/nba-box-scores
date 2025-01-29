import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';

const DATA_DIR = '/Users/jacobmatson/code/nba-box-scores/nba-box-scores/data';
const SCHEDULE_DIR = path.join(DATA_DIR, 'schedule');
const BOX_SCORES_DIR = path.join(DATA_DIR, 'box_scores');

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

        const response = await axios.get('https://api.pbpstats.com/get-game-stats', {
          params: {
            GameId: gameId,
            Type: 'Player'
          },
          headers: {
            'accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Origin': 'https://pbpstats.com',
            'Referer': 'https://pbpstats.com/'
          }
        });

        if (!response.data) {
          console.error(`No data returned for game ${gameId}`);
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

        // If we get rate limited, wait longer
        if (err.response?.status === 429) {
          console.log('Rate limited, waiting 10 seconds...');
          await sleep(10000);
        } else {
          // Otherwise just wait 2 seconds
          await sleep(2000);
        }
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
