import * as fs from 'fs/promises';
import * as path from 'path';
import { getConnection, queryDb } from '../lib/db';

const DATA_DIR = '/Users/jacobmatson/code/nba-box-scores/nba-box-scores/data';
const SCHEDULE_DIR = path.join(DATA_DIR, 'schedule');

const updateSchedule = async () => {
  try {
    // Load completed games from file
    const completedGamesFile = path.join(SCHEDULE_DIR, 'completed-games.json');
    const completedGames = JSON.parse(await fs.readFile(completedGamesFile, 'utf-8'));
    
    // Filter out preseason games (starting with 001)
    const regularSeasonGames = completedGames.filter(game => !game.gameId.startsWith('001'));
    console.log(`Found ${regularSeasonGames.length} regular season games out of ${completedGames.length} total games`);
    
    // Log the first game to see its structure
    console.log('First game:', JSON.stringify(regularSeasonGames[0], null, 2));

    // Connect to database
    const db = await getConnection();
    if (!db) {
      throw new Error('Failed to connect to database');
    }

    // Insert games into database
    for (const game of regularSeasonGames) {
      try {
        await queryDb(`
          INSERT INTO main.schedule (
            game_id,
            game_date,
            home_team_abbreviation,
            away_team_abbreviation,
            home_team_score,
            away_team_score,
            status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          game.gameId,
          new Date(game.gameDateEst),
          game.homeTeam.teamTricode,
          game.awayTeam.teamTricode,
          game.homeTeam.score,
          game.awayTeam.score,
          game.gameStatusText
        ]);
        console.log(`Inserted game ${game.gameId} into database`);
      } catch (err: any) {
        if (err.message.includes('UNIQUE constraint failed')) {
          console.log(`Game ${game.gameId} already exists in database`);
        } else {
          console.error(`Error inserting game ${game.gameId}:`, err);
        }
      }
    }

  } catch (err) {
    console.error('Error in updateSchedule:', err);
    throw err;
  }
};

const main = async () => {
  try {
    await updateSchedule();
    console.log('Done!');
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
};

if (require.main === module) {
  main();
}
