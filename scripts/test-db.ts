import * as duckdb from 'duckdb';
import axios from 'axios';

// Initialize DuckDB with a persistent file
const db = new duckdb.Database('/Users/jacobmatson/code/nba-box-scores/nba-box-scores/data/nba.db');

const initDb = async () => {
  return new Promise<void>((resolve, reject) => {
    db.run(`
      DROP TABLE IF EXISTS games;
      DROP TABLE IF EXISTS box_scores;

      CREATE TABLE games (
        game_id VARCHAR PRIMARY KEY,
        date DATE,
        start_time TIMESTAMP,
        home_team_id VARCHAR,
        home_team_name VARCHAR,
        home_team_score INTEGER,
        away_team_id VARCHAR,
        away_team_name VARCHAR,
        away_team_score INTEGER,
        status VARCHAR,
        period INTEGER,
        clock VARCHAR,
        updated_at TIMESTAMP
      );

      CREATE INDEX games_date_idx ON games(date);
      CREATE INDEX games_status_idx ON games(status);
      CREATE INDEX games_team_idx ON games(home_team_id, away_team_id);

      CREATE TABLE box_scores (
        game_id VARCHAR,
        team_id VARCHAR,
        player_name VARCHAR,
        minutes VARCHAR,
        points INTEGER,
        rebounds INTEGER,
        assists INTEGER,
        steals INTEGER,
        blocks INTEGER,
        turnovers INTEGER,
        fg_made INTEGER,
        fg_attempted INTEGER,
        fg3_made INTEGER,
        fg3_attempted INTEGER,
        ft_made INTEGER,
        ft_attempted INTEGER,
        plus_minus INTEGER,
        starter BOOLEAN,
        updated_at TIMESTAMP,
        PRIMARY KEY (game_id, team_id, player_name)
      );

      CREATE INDEX box_scores_game_idx ON box_scores(game_id);
      CREATE INDEX box_scores_team_idx ON box_scores(team_id);
      CREATE INDEX box_scores_player_idx ON box_scores(player_name);
    `, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

const testScheduleFetch = async () => {
  try {
    console.log('Fetching NBA schedule...');
    const response = await axios.get(
      'https://data.nba.com/data/10s/v2015/json/mobile_teams/nba/2024/league/00_full_schedule.json'
    );

    let gamesProcessed = 0;
    const connection = db.connect();

    // Prepare the insert statement
    const stmt = connection.prepare(`
      INSERT INTO games (
        game_id, date, start_time, home_team_id, home_team_name, home_team_score,
        away_team_id, away_team_name, away_team_score, status, period, clock, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const month of response.data.lscd) {
      for (const game of month.mscd.g) {
        const gameDate = new Date(game.gdte);
        const now = new Date().toISOString();

        stmt.run(
          game.gid,
          gameDate.toISOString().split('T')[0],
          game.etm,
          game.h.tid,
          game.h.tn,
          parseInt(game.h.s || '0'),
          game.v.tid,
          game.v.tn,
          parseInt(game.v.s || '0'),
          game.stt,
          parseInt(game.p || '0'),
          game.cl || '',
          now
        );
        gamesProcessed++;
      }
    }

    stmt.finalize();
    console.log(`Processed ${gamesProcessed} games`);

    // Test query to verify data
    connection.all(`
      SELECT 
        date,
        home_team_name,
        home_team_score,
        away_team_name,
        away_team_score,
        status
      FROM games
      WHERE date >= current_date - interval '2 days'
      ORDER BY date DESC, start_time DESC
      LIMIT 5;
    `, (err, rows) => {
      if (err) console.error('Query error:', err);
      else {
        console.log('\nRecent games:');
        console.table(rows);
      }
    });

    connection.close();
  } catch (err) {
    console.error('Error:', err);
  }
};

const testBoxScoreFetch = async () => {
  try {
    console.log('\nFetching a sample box score...');
    const connection = db.connect();

    // Get a completed game to test with
    connection.all(`
      SELECT game_id, home_team_id, away_team_id
      FROM games
      WHERE status = 'Final' AND game_id LIKE '002%'
      LIMIT 1;
    `, async (err, rows) => {
      if (err) {
        console.error('Query error:', err);
        connection.close();
        return;
      }

      if (rows.length === 0) {
        console.log('No completed games found');
        connection.close();
        return;
      }

      const game = rows[0];
      console.log('Fetching box score for game:', game.game_id);

      try {
        const response = await axios.get('https://api.pbpstats.com/get-game-stats', {
          params: {
            GameId: game.game_id,
            Type: 'Player'
          }
        });

        if (!response.data || !response.data.stats) {
          console.log('No box score data available');
          connection.close();
          return;
        }

        let playersProcessed = 0;
        const now = new Date().toISOString();

        // Prepare the insert statement
        const stmt = connection.prepare(`
          INSERT INTO box_scores (
            game_id, team_id, player_name, minutes, points, rebounds,
            assists, steals, blocks, turnovers, fg_made, fg_attempted,
            fg3_made, fg3_attempted, ft_made, ft_attempted,
            plus_minus, starter, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        for (const playerData of Object.values(response.data.stats) as any[]) {
          stmt.run(
            game.game_id,
            playerData.teamId,
            playerData.name,
            playerData.minutes || '0',
            parseInt(playerData.points || '0'),
            parseInt(playerData.totReb || '0'),
            parseInt(playerData.assists || '0'),
            parseInt(playerData.steals || '0'),
            parseInt(playerData.blocks || '0'),
            parseInt(playerData.turnovers || '0'),
            parseInt(playerData.fgm || '0'),
            parseInt(playerData.fga || '0'),
            parseInt(playerData.tpm || '0'),
            parseInt(playerData.tpa || '0'),
            parseInt(playerData.ftm || '0'),
            parseInt(playerData.fta || '0'),
            parseInt(playerData.plusMinus || '0'),
            playerData.starter === '1',
            now
          );
          playersProcessed++;
        }

        stmt.finalize();
        console.log(`Processed ${playersProcessed} players`);

        // Test query to verify box score data
        connection.all(`
          SELECT 
            player_name,
            minutes,
            points,
            rebounds,
            assists,
            starter
          FROM box_scores
          WHERE game_id = ?
          ORDER BY starter DESC, points DESC;
        `, [game.game_id], (err, rows) => {
          if (err) console.error('Query error:', err);
          else {
            console.log('\nBox score data:');
            console.table(rows);
          }
          connection.close();
        });

      } catch (err) {
        console.error('Error fetching box score:', err);
        connection.close();
      }
    });
  } catch (err) {
    console.error('Error:', err);
  }
};

const main = async () => {
  try {
    await initDb();
    console.log('Database initialized');
    
    await testScheduleFetch();
    
    // Give some time for the first query to complete
    setTimeout(async () => {
      await testBoxScoreFetch();
    }, 1000);
  } catch (err) {
    console.error('Test failed:', err);
  }
};

main();
