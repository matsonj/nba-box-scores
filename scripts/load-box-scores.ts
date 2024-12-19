import { getConnection, queryDb } from '../lib/db';
import * as fs from 'fs/promises';
import * as path from 'path';

const BOX_SCORES_DIR = path.join(process.cwd(), 'data', 'box_scores');

const loadBoxScores = async () => {
  // Get all JSON files in the box_scores directory
  const files = await fs.readdir(BOX_SCORES_DIR);
  const jsonFiles = files.filter(file => file.endsWith('.json'));

  console.log(`Found ${jsonFiles.length} box score files to process`);

  const conn = await getConnection();

  // Drop existing tables and create new ones
  await conn.run(`
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
      starter INTEGER,  -- 1 for true, 0 for false
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
  `);

  // Process each file
  for (const file of jsonFiles) {
    const filePath = path.join(BOX_SCORES_DIR, file);
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    const gameId = data.game.gameId;
    const homeTeamId = data.game.homeTeam.teamId;
    const awayTeamId = data.game.awayTeam.teamId;
    const homeTeamAbbrev = data.game.homeTeam.teamTricode;
    const awayTeamAbbrev = data.game.awayTeam.teamTricode;

    // Process player stats for both teams
    for (const teamType of ['Away', 'Home'] as const) {
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
            const fg2Made = parseInt(player.FG2M || '0');
            const fg3Made = parseInt(player.FG3M || '0');
            const fg2Attempted = parseInt(player.FG2A || '0');
            const fg3Attempted = parseInt(player.FG3A || '0');
            const offReb = parseInt(player.OffRebounds || '0');
            const defReb = parseInt(player.DefRebounds || '0');

            await queryDb(`
              INSERT OR REPLACE INTO box_scores (
                game_id, team_id, entity_id, player_name, minutes,
                points, rebounds, assists, steals, blocks, turnovers,
                fg_made, fg_attempted, fg3_made, fg3_attempted,
                ft_made, ft_attempted, plus_minus, starter, period
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
            `, [
              gameId,
              teamId,
              player.EntityId,
              player.Name,
              player.Minutes || '0:00',
              parseInt(player.Points || '0'),
              offReb + defReb,
              parseInt(player.Assists || '0'),
              parseInt(player.Steals || '0'),
              parseInt(player.Blocks || '0'),
              parseInt(player.Turnovers || '0'),
              fg2Made + fg3Made,
              fg2Attempted + fg3Attempted,
              fg3Made,
              fg3Attempted,
              0, // FT stats not available in this format
              0,
              0, // Plus/minus not available
              period === '1' ? 1 : 0, // Convert boolean to integer
              period
            ]);
          } catch (err) {
            console.error('Error inserting player stats:', err);
            console.error('Player:', player);
            throw err;
          }
        }

        // Calculate team stats
        const teamStats = players.reduce((acc, player) => {
          if (player.EntityId === '0') return acc;
          
          return {
            minutes: '48:00', // Full game
            offPoss: parseInt(player.OffPoss || '0') + acc.offPoss,
            defPoss: parseInt(player.DefPoss || '0') + acc.defPoss,
            points: parseInt(player.Points || '0') + acc.points,
            fgm: (parseInt(player.FG2M || '0') + parseInt(player.FG3M || '0')) + acc.fgm,
            fga: (parseInt(player.FG2A || '0') + parseInt(player.FG3A || '0')) + acc.fga,
            tpm: parseInt(player.FG3M || '0') + acc.tpm,
            tpa: parseInt(player.FG3A || '0') + acc.tpa,
            offReb: parseInt(player.OffRebounds || '0') + acc.offReb,
            defReb: parseInt(player.DefRebounds || '0') + acc.defReb,
            assists: parseInt(player.Assists || '0') + acc.assists,
            steals: parseInt(player.Steals || '0') + acc.steals,
            blocks: parseInt(player.Blocks || '0') + acc.blocks,
            turnovers: parseInt(player.Turnovers || '0') + acc.turnovers,
            fouls: parseInt(player.Fouls || '0') + acc.fouls,
          };
        }, {
          minutes: '0:00',
          offPoss: 0,
          defPoss: 0,
          points: 0,
          fgm: 0,
          fga: 0,
          tpm: 0,
          tpa: 0,
          offReb: 0,
          defReb: 0,
          assists: 0,
          steals: 0,
          blocks: 0,
          turnovers: 0,
          fouls: 0,
        });

        try {
          await queryDb(`
            INSERT OR REPLACE INTO team_stats (
              game_id, team_id, team_abbreviation, period, minutes,
              offensive_possessions, defensive_possessions,
              points, field_goals_made, field_goals_attempted,
              three_pointers_made, three_pointers_attempted,
              free_throws_made, free_throws_attempted,
              offensive_rebounds, defensive_rebounds,
              assists, steals, blocks, turnovers, personal_fouls
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
          `, [
            gameId,
            teamId,
            teamAbbrev,
            period,
            teamStats.minutes,
            teamStats.offPoss,
            teamStats.defPoss,
            teamStats.points,
            teamStats.fgm,
            teamStats.fga,
            teamStats.tpm,
            teamStats.tpa,
            0, // FT stats not available
            0,
            teamStats.offReb,
            teamStats.defReb,
            teamStats.assists,
            teamStats.steals,
            teamStats.blocks,
            teamStats.turnovers,
            teamStats.fouls
          ]);
        } catch (err) {
          console.error('Error inserting team stats:', err);
          console.error('Team Stats:', teamStats);
          throw err;
        }
      }
    }

    console.log(`Processed game ${gameId}`);
  }

  console.log('Done!');
};

loadBoxScores().catch(console.error);
