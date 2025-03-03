"""NBA box score parser for processing game data into DuckDB."""
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import duckdb


def create_database_schema(conn: duckdb.DuckDBPyConnection) -> None:
    """Create the database schema if it doesn't exist."""
    conn.execute("""
        CREATE TABLE IF NOT EXISTS player_stats (
            season TEXT,
            game_id TEXT,
            game_date DATE,
            team TEXT,
            player_id TEXT,
            player_name TEXT,
            period TEXT,
            stat_name TEXT,
            stat_value TEXT,
            PRIMARY KEY (game_id, player_id, period, stat_name)
        );
    """)
    
    conn.execute("""
        CREATE TABLE IF NOT EXISTS processed_files (
            file_name TEXT PRIMARY KEY,
            processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    
    conn.execute("""
        CREATE OR REPLACE VIEW player_game_stats AS
        WITH period_stats AS (
            SELECT 
                game_id,
                team as team_id,
                player_id as entity_id,
                player_name,
                period,
                MAX(CASE WHEN stat_name = 'Minutes' THEN stat_value END) as minutes,
                CAST(COALESCE(MAX(CASE WHEN stat_name = 'Points' THEN stat_value END), '0') AS INTEGER) as points,
                CAST(COALESCE(MAX(CASE WHEN stat_name = 'OffRebounds' THEN stat_value END), '0') AS INTEGER) + 
                CAST(COALESCE(MAX(CASE WHEN stat_name = 'DefRebounds' THEN stat_value END), '0') AS INTEGER) as rebounds,
                CAST(COALESCE(MAX(CASE WHEN stat_name = 'Assists' THEN stat_value END), '0') AS INTEGER) as assists,
                CAST(COALESCE(MAX(CASE WHEN stat_name = 'Steals' THEN stat_value END), '0') AS INTEGER) as steals,
                CAST(COALESCE(MAX(CASE WHEN stat_name = 'Blocks' THEN stat_value END), '0') AS INTEGER) as blocks,
                CAST(COALESCE(MAX(CASE WHEN stat_name = 'Turnovers' THEN stat_value END), '0') AS INTEGER) as turnovers,
                CAST(COALESCE(MAX(CASE WHEN stat_name = 'FG2M' THEN stat_value END), '0') AS INTEGER) + 
                CAST(COALESCE(MAX(CASE WHEN stat_name = 'FG3M' THEN stat_value END), '0') AS INTEGER) as fg_made,
                CAST(COALESCE(MAX(CASE WHEN stat_name = 'FG2A' THEN stat_value END), '0') AS INTEGER) + 
                CAST(COALESCE(MAX(CASE WHEN stat_name = 'FG3A' THEN stat_value END), '0') AS INTEGER) as fg_attempted,
                CAST(COALESCE(MAX(CASE WHEN stat_name = 'FG3M' THEN stat_value END), '0') AS INTEGER) as fg3_made,
                CAST(COALESCE(MAX(CASE WHEN stat_name = 'FG3A' THEN stat_value END), '0') AS INTEGER) as fg3_attempted,
                CAST(COALESCE(MAX(CASE WHEN stat_name = 'FtPoints' THEN stat_value END), '0') AS INTEGER) as ft_made,
                CAST(COALESCE(MAX(CASE WHEN stat_name = 'FTA' THEN stat_value END), '0') AS INTEGER) as ft_attempted,
                NULL as plus_minus
            FROM player_stats
            WHERE player_id != '0'
            GROUP BY game_id, team, player_id, player_name, period
        ),
        period_stats_with_starter AS (
            SELECT 
                ps.*,
                CASE 
                    WHEN ROW_NUMBER() OVER (PARTITION BY game_id, team_id ORDER BY points DESC) <= 5 THEN 1
                    ELSE 0
                END as starter
            FROM period_stats ps
            WHERE period != 'FullGame'
        )
        SELECT * FROM period_stats_with_starter
        UNION ALL
        SELECT 
            game_id,
            team_id,
            entity_id,
            player_name,
            'FullGame' as period,
            CONCAT(
                CAST(SUM(
                    -- Convert MM:SS to seconds
                    CAST(SPLIT_PART(minutes, ':', 1) AS INTEGER) * 60 + 
                    CAST(SPLIT_PART(minutes, ':', 2) AS INTEGER)
                ) / 60 AS INTEGER),
                ':',
                LPAD(
                    CAST(SUM(
                        CAST(SPLIT_PART(minutes, ':', 1) AS INTEGER) * 60 + 
                        CAST(SPLIT_PART(minutes, ':', 2) AS INTEGER)
                    ) % 60 AS VARCHAR),
                    2,
                    '0'
                )
            ) as minutes,
            SUM(points) as points,
            SUM(rebounds) as rebounds,
            SUM(assists) as assists,
            SUM(steals) as steals,
            SUM(blocks) as blocks,
            SUM(turnovers) as turnovers,
            SUM(fg_made) as fg_made,
            SUM(fg_attempted) as fg_attempted,
            SUM(fg3_made) as fg3_made,
            SUM(fg3_attempted) as fg3_attempted,
            SUM(ft_made) as ft_made,
            SUM(ft_attempted) as ft_attempted,
            NULL as plus_minus,
            MAX(starter) as starter
        FROM period_stats_with_starter
        GROUP BY game_id, team_id, entity_id, player_name;
    """)


def is_file_processed(conn: duckdb.DuckDBPyConnection, file_name: str) -> bool:
    """Check if a file has already been processed."""
    result = conn.execute(
        "SELECT COUNT(*) FROM processed_files WHERE file_name = ?",
        [file_name]
    ).fetchone()[0]
    return result > 0


def mark_file_as_processed(conn: duckdb.DuckDBPyConnection, file_name: str) -> None:
    """Mark a file as processed."""
    conn.execute(
        "INSERT INTO processed_files (file_name) VALUES (?)",
        [file_name]
    )


def extract_game_metadata(game_data: Dict[str, Any]) -> Dict[str, Any]:
    """Extract metadata from game data."""
    return {
        'game_id': game_data['gameId'],
        'season': str(int(game_data['gameDateEst'][:4]) - 1) + "-" + game_data['gameDateEst'][:4][-2:],
        'game_date': datetime.strptime(game_data['gameDateEst'][:10], '%Y-%m-%d').date(),
        'away_team': game_data['awayTeam']['teamTricode'],
        'home_team': game_data['homeTeam']['teamTricode']
    }


def process_player_stats(
    stats: Dict[str, Any],
    metadata: Dict[str, Any],
    team: str,
    period: str
) -> List[Dict[str, Any]]:
    """Process player statistics for a given period."""
    result = []
    
    # Skip the "Team" entity as it's not a player
    player_stats = [s for s in stats if s['EntityId'] != '0']
    
    # Convert period to sequential number (1-4 for quarters, 5+ for overtime)
    try:
        period_num = int(period)
        if period_num > 4:
            # Already in the correct format (5,6,etc for overtime)
            normalized_period = period
        else:
            normalized_period = str(period_num)
    except ValueError:
        # Handle OT periods
        if period.startswith('OT'):
            try:
                ot_num = int(period[2:])
                normalized_period = str(ot_num + 4)
            except ValueError:
                normalized_period = period
        else:
            normalized_period = period
    
    for player in player_stats:
        # Handle Minutes field specially
        if 'Minutes' in player:
            result.append({
                'season': metadata['season'],
                'game_id': metadata['game_id'],
                'game_date': metadata['game_date'],
                'team': team,
                'player_id': player['EntityId'],
                'player_name': player['Name'],
                'period': normalized_period,
                'stat_name': 'Minutes',
                'stat_value': player['Minutes']
            })
            
        # Get all numeric stats
        for stat_name, stat_value in player.items():
            if isinstance(stat_value, (int, float)) and stat_name not in ['EntityId']:
                result.append({
                    'season': metadata['season'],
                    'game_id': metadata['game_id'],
                    'game_date': metadata['game_date'],
                    'team': team,
                    'player_id': player['EntityId'],
                    'player_name': player['Name'],
                    'period': normalized_period,
                    'stat_name': stat_name,
                    'stat_value': str(stat_value)
                })
    
    return result


def process_game_file(file_path: Path, conn: duckdb.DuckDBPyConnection) -> None:
    """Process a single game file and store the data in DuckDB."""
    try:
        # Check if file has already been processed
        if is_file_processed(conn, file_path.name):
            print(f"Skipping already processed file: {file_path.name}")
            return

        # Load and parse JSON
        with open(file_path, 'r') as f:
            data = json.load(f)
        
        # Extract metadata
        metadata = extract_game_metadata(data['game'])
        
        # Process stats for both teams and all periods
        all_stats = []
        box_score = data['boxScore']['stats']
        
        for team_key, team_data in box_score.items():  # Away and Home
            team = metadata[f'{team_key.lower()}_team']
            
            for period, period_stats in team_data.items():  # 1, 2, 3, 4, FullGame
                all_stats.extend(process_player_stats(period_stats, metadata, team, period))
        
        # Insert all stats in a single transaction
        if all_stats:
            placeholders = ", ".join(["(?, ?, ?, ?, ?, ?, ?, ?, ?)"] * len(all_stats))
            values = [
                val for stat in all_stats
                for val in (
                    stat['season'], stat['game_id'], stat['game_date'],
                    stat['team'], stat['player_id'], stat['player_name'],
                    stat['period'], stat['stat_name'], stat['stat_value']
                )
            ]
            
            conn.execute(f"""
                INSERT INTO player_stats (
                    season, game_id, game_date, team, player_id,
                    player_name, period, stat_name, stat_value
                )
                VALUES {placeholders}
                ON CONFLICT DO NOTHING
            """, values)
            
        # Mark file as processed
        mark_file_as_processed(conn, file_path.name)
        print(f"Successfully processed file: {file_path.name}")
        
    except Exception as e:
        print(f"Error processing file {file_path.name}: {str(e)}")
        raise
