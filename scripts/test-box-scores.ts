import * as duckdb from 'duckdb';

// Initialize DuckDB with a persistent file
const db = new duckdb.Database('/Users/jacobmatson/code/nba-box-scores/nba-box-scores/data/nba.db');

const testQueries = async () => {
  // Test query 1: Count total games
  await new Promise<void>((resolve, reject) => {
    db.all(`
      SELECT COUNT(DISTINCT game_id) as total_games
      FROM box_scores;
    `, (err, result) => {
      if (err) reject(err);
      else {
        console.log('Total games:', result[0].total_games);
        resolve();
      }
    });
  });

  // Test query 2: Top 10 scorers
  await new Promise<void>((resolve, reject) => {
    db.all(`
      SELECT 
        player_name,
        COUNT(DISTINCT game_id) as games_played,
        ROUND(AVG(points), 1) as ppg,
        ROUND(AVG(rebounds), 1) as rpg,
        ROUND(AVG(assists), 1) as apg
      FROM box_scores
      WHERE period = 'FullGame'
      GROUP BY player_name
      HAVING games_played >= 10
      ORDER BY ppg DESC
      LIMIT 10;
    `, (err, result) => {
      if (err) reject(err);
      else {
        console.log('\nTop 10 scorers (min. 10 games):');
        console.table(result);
        resolve();
      }
    });
  });

  // Test query 3: Team stats
  await new Promise<void>((resolve, reject) => {
    db.all(`
      SELECT 
        team_abbreviation,
        COUNT(DISTINCT game_id) as games_played,
        ROUND(AVG(points), 1) as ppg,
        ROUND(AVG(offensive_possessions), 1) as poss_per_game,
        ROUND(AVG(points)::FLOAT * 100 / AVG(offensive_possessions), 1) as offensive_rating
      FROM team_stats
      WHERE period = 'FullGame'
      GROUP BY team_abbreviation
      HAVING games_played >= 5
      ORDER BY offensive_rating DESC;
    `, (err, result) => {
      if (err) reject(err);
      else {
        console.log('\nTeam offensive ratings:');
        console.table(result);
        resolve();
      }
    });
  });
};

testQueries().catch(console.error);
