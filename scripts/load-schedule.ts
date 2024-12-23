import * as fs from 'fs/promises';
import * as path from 'path';
import { getConnection, queryDb } from '../lib/db';

const DATA_DIR = '/Users/jacobmatson/code/nba-box-scores/nba-box-scores/data';
const SCHEDULE_DIR = path.join(DATA_DIR, 'schedule');

const loadSchedule = async () => {
  try {
    // Load completed games from file
    const completedGamesFile = path.join(SCHEDULE_DIR, 'completed-games.json');
    const completedGames = JSON.parse(await fs.readFile(completedGamesFile, 'utf-8'));
    
    // Filter out preseason games (starting with 001)
    const regularSeasonGames = completedGames.filter(game => !game.gameId.startsWith('001'));
    console.log(`Found ${regularSeasonGames.length} regular season games out of ${completedGames.length} total games`);
    
    // Log first game for debugging
    console.log('First game data:', JSON.stringify(regularSeasonGames[0], null, 2));

    // Connect to database
    const db = await getConnection();
    if (!db) {
      throw new Error('Failed to connect to database');
    }

    // Drop existing table if it exists
    console.log('Dropping existing schedule table...');
    await queryDb('DROP TABLE IF EXISTS main.schedule');

    // Create schedule table
    console.log('Creating schedule table...');
    await queryDb(`
      CREATE TABLE main.schedule (
        game_id TEXT PRIMARY KEY,
        game_date TIMESTAMP NOT NULL,
        home_team_id INTEGER NOT NULL,
        away_team_id INTEGER NOT NULL,
        home_team_abbreviation TEXT NOT NULL,
        away_team_abbreviation TEXT NOT NULL,
        home_team_score INTEGER NOT NULL,
        away_team_score INTEGER NOT NULL,
        status TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert games into schedule table
    console.log('Inserting games into schedule table...');
    for (const game of regularSeasonGames) {
      try {
        await queryDb(`
          INSERT INTO main.schedule (
            game_id,
            game_date,
            home_team_id,
            away_team_id,
            home_team_abbreviation,
            away_team_abbreviation,
            home_team_score,
            away_team_score,
            status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          game.gameId,
          game.gameDateTimeUTC,
          game.homeTeam.teamId,
          game.awayTeam.teamId,
          game.homeTeam.teamTricode,
          game.awayTeam.teamTricode,
          game.homeTeam.score,
          game.awayTeam.score,
          game.gameStatusText
        ]);
        console.log(`Inserted game ${game.gameId} into database`);

        // Insert period scores if available
        if (game.homeTeam.periods && game.awayTeam.periods) {
          for (let i = 0; i < game.homeTeam.periods.length; i++) {
            // Home team period score
            await queryDb(`
              INSERT INTO main.period_scores (game_id, team_id, period, score)
              VALUES ($1, $2, $3, $4)
            `, [
              game.gameId,
              game.homeTeam.teamId,
              i + 1,
              game.homeTeam.periods[i].score
            ]);

            // Away team period score
            await queryDb(`
              INSERT INTO main.period_scores (game_id, team_id, period, score)
              VALUES ($1, $2, $3, $4)
            `, [
              game.gameId,
              game.awayTeam.teamId,
              i + 1,
              game.awayTeam.periods[i].score
            ]);
          }
          console.log(`Inserted period scores for game ${game.gameId}`);
        }
      } catch (err: any) {
        if (err.message.includes('UNIQUE constraint failed')) {
          console.log(`Game ${game.gameId} already exists in database`);
        } else {
          console.error(`Error inserting game ${game.gameId}:`, err.message);
        }
      }
    }

    console.log('Schedule load complete!');
  } catch (err: any) {
    console.error('Error:', err.message);
    throw err;
  }
};

const main = async () => {
  try {
    await loadSchedule();
    console.log('Done!');
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
};

if (require.main === module) {
  main();
}
