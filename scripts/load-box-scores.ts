import * as duckdb from 'duckdb';
import * as fs from 'fs/promises';
import * as path from 'path';

// Initialize DuckDB with a persistent file
const db = new duckdb.Database('/Users/jacobmatson/code/nba-box-scores/nba-box-scores/data/nba.db');

const BOX_SCORES_DIR = '/Users/jacobmatson/code/nba-box-scores/nba-box-scores/data/box_scores';

const loadBoxScores = async () => {
  // Get all JSON files in the box_scores directory
  const files = await fs.readdir(BOX_SCORES_DIR);
  const jsonFiles = files.filter(file => file.endsWith('.json'));

  console.log(`Found ${jsonFiles.length} box score files to process`);

  // Drop existing tables and create new ones
  await new Promise<void>((resolve, reject) => {
    db.exec(`
      DROP TABLE IF EXISTS box_scores;
      DROP TABLE IF EXISTS team_stats;

      CREATE TABLE box_scores (
        game_id VARCHAR,
        team_id VARCHAR,
        entity_id VARCHAR,
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
        period VARCHAR,  -- '1', '2', '3', '4', or 'FullGame'
        PRIMARY KEY (game_id, team_id, entity_id, period)
      );

      CREATE TABLE team_stats (
        game_id VARCHAR,
        team_id VARCHAR,
        team_abbreviation VARCHAR,
        period VARCHAR,
        minutes VARCHAR,
        offensive_possessions INTEGER,
        defensive_possessions INTEGER,
        points INTEGER,
        field_goals_made INTEGER,
        field_goals_attempted INTEGER,
        three_pointers_made INTEGER,
        three_pointers_attempted INTEGER,
        free_throws_made INTEGER,
        free_throws_attempted INTEGER,
        offensive_rebounds INTEGER,
        defensive_rebounds INTEGER,
        assists INTEGER,
        steals INTEGER,
        blocks INTEGER,
        turnovers INTEGER,
        personal_fouls INTEGER,
        PRIMARY KEY (game_id, team_id, period)
      );

      CREATE INDEX box_scores_game_idx ON box_scores(game_id);
      CREATE INDEX box_scores_player_idx ON box_scores(entity_id);
      CREATE INDEX box_scores_team_idx ON box_scores(team_id);
      CREATE INDEX team_stats_game_idx ON team_stats(game_id);
      CREATE INDEX team_stats_team_idx ON team_stats(team_id);
    `, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  // Prepare statements
  const playerStmt = db.prepare(`
    INSERT OR REPLACE INTO box_scores (
      game_id, team_id, entity_id, player_name, minutes,
      points, rebounds, assists, steals, blocks, turnovers,
      fg_made, fg_attempted, fg3_made, fg3_attempted,
      ft_made, ft_attempted, plus_minus, starter, period
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const teamStmt = db.prepare(`
    INSERT OR REPLACE INTO team_stats (
      game_id, team_id, team_abbreviation, period, minutes,
      offensive_possessions, defensive_possessions,
      points, field_goals_made, field_goals_attempted,
      three_pointers_made, three_pointers_attempted,
      free_throws_made, free_throws_attempted,
      offensive_rebounds, defensive_rebounds,
      assists, steals, blocks, turnovers, personal_fouls
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Process each file
  for (const file of jsonFiles) {
    const filePath = path.join(BOX_SCORES_DIR, file);
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    const gameId = data.game.gameId;
    const homeTeamId = data.boxScore.home_team_id;
    const awayTeamId = data.boxScore.away_team_id;
    const homeTeamAbbrev = data.boxScore.home_team_abbreviation;
    const awayTeamAbbrev = data.boxScore.away_team_abbreviation;

    // Process player stats for both teams
    for (const teamType of ['Home', 'Away'] as const) {
      const teamId = teamType === 'Home' ? homeTeamId : awayTeamId;
      const teamAbbrev = teamType === 'Home' ? homeTeamAbbrev : awayTeamAbbrev;
      const periods = ['1', '2', '3', '4', 'FullGame'];

      for (const period of periods) {
        // Skip if stats for this period don't exist
        if (!data.boxScore.stats?.[teamType]?.[period]) {
          continue;
        }

        const players = data.boxScore.stats[teamType][period];
        
        // Skip the "Team" entry which has EntityId "0"
        const playerStats = players.filter(p => p.EntityId !== '0');

        // Insert player stats
        for (const player of playerStats) {
          try {
            playerStmt.run(
              gameId,
              teamId,
              player.EntityId,
              player.Name,
              player.Minutes || '0:00',
              player.Points || 0,
              (player.OffReb || 0) + (player.DefReb || 0),
              player.Assists || 0,
              player.Steals || 0,
              player.Blocks || 0,
              player.Turnovers || 0,
              player.FGM || 0,
              player.FGA || 0,
              player.TPM || 0,
              player.TPA || 0,
              player.FTM || 0,
              player.FTA || 0,
              player.PlusMinus || 0,
              period === '1',
              period
            );
          } catch (err) {
            console.error('Error inserting player stats:', err);
            console.error('Player:', player);
            throw err;
          }
        }

        // Insert team stats
        const teamStats = data.boxScore.team_results[teamType][period];
        if (teamStats) {
          try {
            teamStmt.run(
              gameId,
              teamId,
              teamAbbrev,
              period,
              teamStats.Minutes || '0:00',
              teamStats.OffPoss || 0,
              teamStats.DefPoss || 0,
              teamStats.Points || 0,
              teamStats.FGM || 0,
              teamStats.FGA || 0,
              teamStats.TPM || 0,
              teamStats.TPA || 0,
              teamStats.FTM || 0,
              teamStats.FTA || 0,
              teamStats.OffReb || 0,
              teamStats.DefReb || 0,
              teamStats.Assists || 0,
              teamStats.Steals || 0,
              teamStats.Blocks || 0,
              teamStats.Turnovers || 0,
              teamStats.Fouls || 0
            );
          } catch (err) {
            console.error('Error inserting team stats:', err);
            console.error('Team Stats:', teamStats);
            throw err;
          }
        }
      }
    }

    console.log(`Processed box score for game ${gameId}`);
  }

  // Finalize statements
  playerStmt.finalize();
  teamStmt.finalize();

  console.log('Finished loading all box scores');
};

loadBoxScores().catch(console.error);
