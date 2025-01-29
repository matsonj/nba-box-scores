import * as fs from 'fs/promises';
import * as path from 'path';
import { queryDb } from '../lib/db';

const DATA_DIR = '/Users/jacobmatson/code/nba-box-scores/nba-box-scores/data';
const SCHEDULE_DIR = path.join(DATA_DIR, 'schedule');

const loadSchedule = async () => {
  try {
    // Load completed games from file
    const completedGamesFile = path.join(SCHEDULE_DIR, 'completed-games.json');
    const completedGames = JSON.parse(await fs.readFile(completedGamesFile, 'utf-8'));
    
    // Filter out preseason games (starting with 001)
    const regularSeasonGames = completedGames.filter((game: { gameId: string }) => !game.gameId.startsWith('001'));
    console.log(`Found ${regularSeasonGames.length} regular season games out of ${completedGames.length} total games`);
    
    // Log first game for debugging
    console.log('First game data:', JSON.stringify(regularSeasonGames[0], null, 2));

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

    // Insert games into schedule table in batches
    console.log('Inserting games into schedule table...');
    const BATCH_SIZE = 100;
    
    for (let i = 0; i < regularSeasonGames.length; i += BATCH_SIZE) {
      const batch = regularSeasonGames.slice(i, i + BATCH_SIZE);
      const values = batch.map((_: unknown, index: number) =>
        `($${index * 9 + 1}, $${index * 9 + 2}, $${index * 9 + 3}, $${index * 9 + 4}, $${index * 9 + 5}, $${index * 9 + 6}, $${index * 9 + 7}, $${index * 9 + 8}, $${index * 9 + 9})`
      ).join(',');

      const params = batch.flatMap((game: { 
        gameId: string,
        gameDateTimeUTC: string,
        homeTeam: { teamId: string, teamTricode: string, score: number, periods: { score: number }[] },
        awayTeam: { teamId: string, teamTricode: string, score: number, periods: { score: number }[] },
        gameStatusText: string
      }) => [
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
          ) VALUES ${values}
        `, params);
        console.log(`Inserted batch of ${batch.length} games (${i + 1} to ${i + batch.length} of ${regularSeasonGames.length})`);

        // Batch insert period scores
        const periodScoresBatch = batch.flatMap((game: { 
          gameId: string,
          homeTeam: { teamId: string, periods?: { score: number }[] },
          awayTeam: { teamId: string, periods?: { score: number }[] }
        }) => {
          if (!game.homeTeam.periods || !game.awayTeam.periods) return [];
          
          const scores = [];
          for (let p = 0; p < game.homeTeam.periods.length; p++) {
            // Home team period score
            scores.push({
              gameId: game.gameId,
              teamId: game.homeTeam.teamId,
              period: p + 1,
              score: game.homeTeam.periods[p].score
            });
            // Away team period score
            scores.push({
              gameId: game.gameId,
              teamId: game.awayTeam.teamId,
              period: p + 1,
              score: game.awayTeam.periods[p].score
            });
          }
          return scores;
        });

        if (periodScoresBatch.length > 0) {
          const periodValues = periodScoresBatch.map((score: { gameId: string, teamId: string, period: number, score: number }, index: number) =>
            `($${index * 4 + 1}, $${index * 4 + 2}, $${index * 4 + 3}, $${index * 4 + 4})`
          ).join(',');

          const periodParams = periodScoresBatch.flatMap((score: { gameId: string, teamId: string, period: number, score: number }) => [
            score.gameId,
            score.teamId,
            score.period,
            score.score
          ]);

          await queryDb(`
            INSERT INTO main.period_scores (game_id, team_id, period, score)
            VALUES ${periodValues}
          `, periodParams);
          console.log(`Inserted period scores for batch of ${batch.length} games`);
        }
      } catch (err: any) {
        console.error(`Error inserting batch starting at game ${i}:`, err.message);
        throw err;
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
