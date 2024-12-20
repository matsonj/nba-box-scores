import { getConnection, queryDb } from '../lib/db';
import * as fs from 'fs/promises';
import * as path from 'path';

const BOX_SCORES_DIR = path.join(process.cwd(), 'data', 'box_scores');
const BATCH_SIZE = 1000;

interface BoxScoreRow {
  game_id: string;
  team_id: string;
  entity_id: string;
  player_name: string;
  minutes: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fg_made: number;
  fg_attempted: number;
  fg3_made: number;
  fg3_attempted: number;
  ft_made: number;
  ft_attempted: number;
  plus_minus: number;
  starter: number;
  period: string;
}

interface TeamStatsRow {
  game_id: string;
  team_id: string;
  period: string;
  minutes: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fg_made: number;
  fg_attempted: number;
  fg3_made: number;
  fg3_attempted: number;
  ft_made: number;
  ft_attempted: number;
  offensive_possessions: number;
  defensive_possessions: number;
}

function escapeString(str: string): string {
  return str.replace(/'/g, "''");
}

async function insertBoxScoreBatch(conn: any, rows: BoxScoreRow[]) {
  if (rows.length === 0) return;

  const values = rows.map(row => `(
    '${row.game_id}',
    '${row.team_id}',
    '${row.entity_id}',
    '${escapeString(row.player_name)}',
    '${row.minutes}',
    ${row.points},
    ${row.rebounds},
    ${row.assists},
    ${row.steals},
    ${row.blocks},
    ${row.turnovers},
    ${row.fg_made},
    ${row.fg_attempted},
    ${row.fg3_made},
    ${row.fg3_attempted},
    ${row.ft_made},
    ${row.ft_attempted},
    ${row.plus_minus},
    ${row.starter},
    '${row.period}'
  )`).join(',\n');

  await conn.run(`
    INSERT INTO box_scores (
      game_id, team_id, entity_id, player_name, minutes,
      points, rebounds, assists, steals, blocks, turnovers,
      fg_made, fg_attempted, fg3_made, fg3_attempted,
      ft_made, ft_attempted, plus_minus, starter, period
    ) VALUES ${values}
  `);
}

async function insertTeamStatsBatch(conn: any, rows: TeamStatsRow[]) {
  if (rows.length === 0) return;

  const values = rows.map(row => `(
    '${row.game_id}',
    '${row.team_id}',
    '${row.period}',
    '${row.minutes}',
    ${row.points},
    ${row.rebounds},
    ${row.assists},
    ${row.steals},
    ${row.blocks},
    ${row.turnovers},
    ${row.fg_made},
    ${row.fg_attempted},
    ${row.fg3_made},
    ${row.fg3_attempted},
    ${row.ft_made},
    ${row.ft_attempted},
    ${row.offensive_possessions},
    ${row.defensive_possessions}
  )`).join(',\n');

  await conn.run(`
    INSERT INTO team_stats (
      game_id, team_id, period, minutes,
      points, rebounds, assists, steals, blocks, turnovers,
      fg_made, fg_attempted, fg3_made, fg3_attempted,
      ft_made, ft_attempted, offensive_possessions, defensive_possessions
    ) VALUES ${values}
  `);
}

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
      period VARCHAR  -- '1', '2', '3', '4', or 'FullGame'
    );

    CREATE TABLE team_stats (
      game_id VARCHAR,
      team_id VARCHAR,
      period VARCHAR,
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
      offensive_possessions INTEGER,
      defensive_possessions INTEGER
    );
  `);

  let boxScoreBatch: BoxScoreRow[] = [];
  let teamStatsBatch: TeamStatsRow[] = [];

  // Process each file
  for (const file of jsonFiles) {
    const filePath = path.join(BOX_SCORES_DIR, file);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      if (!data.boxScore?.stats?.Away || !data.boxScore?.stats?.Home) {
        console.log(`Skipping ${file} - missing required data structure`);
        continue;
      }

      const gameId = data.game.gameId;
      const homeTeamId = data.boxScore.home_team_id;
      const awayTeamId = data.boxScore.away_team_id;

      // Process player stats for both teams
      for (const teamType of ['Away', 'Home'] as const) {
        const teamId = teamType === 'Home' ? homeTeamId : awayTeamId;
        const teamStats = data.boxScore.stats[teamType];

        // Process each player's stats for each period
        for (const period of ['1', '2', '3', '4', '5', 'FullGame'] as const) {
          const periodStats = teamStats[period];
          if (!periodStats) continue;

          // Filter out the "Team" entry which has EntityId "0"
          const players = periodStats.filter((p: any) => p.EntityId !== '0');

          for (const player of players) {
            boxScoreBatch.push({
              game_id: gameId,
              team_id: teamId,
              entity_id: player.EntityId,
              player_name: player.Name,
              minutes: player.Minutes || '0:00',
              points: parseInt(player.Points || '0'),
              rebounds: parseInt(player.OffRebounds || '0') + parseInt(player.DefRebounds || '0'),
              assists: parseInt(player.Assists || '0'),
              steals: parseInt(player.Steals || '0'),
              blocks: parseInt(player.Blocks || '0'),
              turnovers: parseInt(player.Turnovers || '0'),
              fg_made: parseInt(player.FG2M || '0') + parseInt(player.FG3M || '0'),
              fg_attempted: parseInt(player.FG2A || '0') + parseInt(player.FG3A || '0'),
              fg3_made: parseInt(player.FG3M || '0'),
              fg3_attempted: parseInt(player.FG3A || '0'),
              ft_made: parseInt(player.FTM || '0'),
              ft_attempted: parseInt(player.FTA || '0'),
              plus_minus: parseInt(player.PlusMinus || '0'),
              starter: player.Starter ? 1 : 0,
              period
            });

            if (boxScoreBatch.length >= BATCH_SIZE) {
              await insertBoxScoreBatch(conn, boxScoreBatch);
              boxScoreBatch = [];
            }
          }

          // Process team stats
          const teamPeriodStats = data.boxScore.team_results[teamType][period];
          if (!teamPeriodStats) continue;

          teamStatsBatch.push({
            game_id: gameId,
            team_id: teamId,
            period,
            minutes: teamPeriodStats.Minutes || '0:00',
            points: parseInt(teamPeriodStats.Points || '0'),
            rebounds: parseInt(teamPeriodStats.DefRebounds || '0') + parseInt(teamPeriodStats.OffRebounds || '0'),
            assists: parseInt(teamPeriodStats.Assists || '0'),
            steals: parseInt(teamPeriodStats.Steals || '0'),
            blocks: parseInt(teamPeriodStats.Blocks || '0'),
            turnovers: parseInt(teamPeriodStats.Turnovers || '0'),
            fg_made: parseInt(teamPeriodStats.FG2M || '0') + parseInt(teamPeriodStats.FG3M || '0'),
            fg_attempted: parseInt(teamPeriodStats.FG2A || '0') + parseInt(teamPeriodStats.FG3A || '0'),
            fg3_made: parseInt(teamPeriodStats.FG3M || '0'),
            fg3_attempted: parseInt(teamPeriodStats.FG3A || '0'),
            ft_made: parseInt(teamPeriodStats.FTM || '0'),
            ft_attempted: parseInt(teamPeriodStats.FTA || '0'),
            offensive_possessions: parseInt(teamPeriodStats.OffPoss || '0'),
            defensive_possessions: parseInt(teamPeriodStats.DefPoss || '0')
          });

          if (teamStatsBatch.length >= BATCH_SIZE) {
            await insertTeamStatsBatch(conn, teamStatsBatch);
            teamStatsBatch = [];
          }
        }
      }

      console.log(`Processed box score for game ${gameId}`);
    } catch (error) {
      console.error(`Error processing ${file}: ${error.message}`);
    }
  }

  // Insert any remaining rows
  if (boxScoreBatch.length > 0) {
    await insertBoxScoreBatch(conn, boxScoreBatch);
  }
  if (teamStatsBatch.length > 0) {
    await insertTeamStatsBatch(conn, teamStatsBatch);
  }

  console.log('Finished loading box scores');
};

loadBoxScores().catch(console.error);
