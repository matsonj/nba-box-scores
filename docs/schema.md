# NBA Box Scores v2 Database Schema

Database: `nba_box_scores_v2` (MotherDuck)

## Tables

### schedule

Stores the NBA game schedule with scores and metadata.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| game_id | TEXT | PRIMARY KEY | Unique NBA game identifier |
| game_date | TIMESTAMP | NOT NULL | Date/time of the game |
| home_team_id | INTEGER | NOT NULL | NBA team ID for home team |
| away_team_id | INTEGER | NOT NULL | NBA team ID for away team |
| home_team_abbreviation | TEXT | NOT NULL | e.g. "LAL", "BOS" |
| away_team_abbreviation | TEXT | NOT NULL | e.g. "GSW", "MIA" |
| home_team_score | INTEGER | NOT NULL | Final home score |
| away_team_score | INTEGER | NOT NULL | Final away score |
| status | TEXT | NOT NULL | Game status (e.g. "Final") |
| season_year | INTEGER | | Season start year (e.g. 2025 for 2025-26) |
| season_type | TEXT | | e.g. "Regular Season", "Playoffs" |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Row creation time |

### box_scores

Player-level box score stats, broken down by period.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| game_id | VARCHAR | PK (composite) | Game identifier |
| team_id | VARCHAR | | Team identifier |
| entity_id | VARCHAR | PK (composite) | Player identifier |
| player_name | VARCHAR | | Player display name |
| period | VARCHAR | PK (composite), NOT NULL, DEFAULT 'FullGame' | Period name (Q1-Q4, OT1, FullGame) |
| minutes | VARCHAR | | Minutes played (e.g. "34:21") |
| points | INTEGER | NOT NULL, DEFAULT 0 | Points scored |
| rebounds | INTEGER | NOT NULL, DEFAULT 0 | Total rebounds |
| assists | INTEGER | NOT NULL, DEFAULT 0 | Assists |
| steals | INTEGER | NOT NULL, DEFAULT 0 | Steals |
| blocks | INTEGER | NOT NULL, DEFAULT 0 | Blocks |
| turnovers | INTEGER | NOT NULL, DEFAULT 0 | Turnovers |
| fg_made | INTEGER | NOT NULL, DEFAULT 0 | Field goals made |
| fg_attempted | INTEGER | NOT NULL, DEFAULT 0 | Field goals attempted |
| fg3_made | INTEGER | NOT NULL, DEFAULT 0 | Three-pointers made |
| fg3_attempted | INTEGER | NOT NULL, DEFAULT 0 | Three-pointers attempted |
| ft_made | INTEGER | NOT NULL, DEFAULT 0 | Free throws made |
| ft_attempted | INTEGER | NOT NULL, DEFAULT 0 | Free throws attempted |
| plus_minus | INTEGER | | Plus/minus |
| starter | INTEGER | | 1 if starter, 0 if bench |

**Primary Key:** `(game_id, entity_id, period)`

### ingestion_log

Tracks which games have been ingested and their status.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| game_id | TEXT | PRIMARY KEY | Game identifier |
| season_year | INTEGER | NOT NULL | Season year |
| season_type | TEXT | NOT NULL | Season type |
| ingested_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | When ingestion occurred |
| status | TEXT | NOT NULL, DEFAULT 'success' | 'success' or 'error' |
| error_message | TEXT | | Error details if failed |

### data_quality_quarantine

Records data quality issues found during ingestion or validation.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Auto-increment ID |
| game_id | TEXT | NOT NULL | Affected game |
| check_name | TEXT | NOT NULL | Name of the quality check |
| severity | TEXT | NOT NULL, DEFAULT 'warning' | 'warning' or 'error' |
| message | TEXT | NOT NULL | Human-readable description |
| details | TEXT | | JSON or additional context |
| detected_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | When detected |
| resolved_at | TIMESTAMP | | When resolved (NULL if open) |
| resolution | TEXT | | How it was resolved |
| github_issue_number | INTEGER | | Linked GitHub issue |

## Views

### team_stats

Derived from `box_scores`. Aggregates player stats into team-level totals per period and full game.

**Logic:**
1. For each non-FullGame period, sum all player stats grouped by `(game_id, team_id, period)` with minutes set to `'12:00'`.
2. Union with a FullGame row that sums across all period rows (not FullGame player rows) with minutes set to `NULL`.

| Column | Type | Description |
|--------|------|-------------|
| game_id | VARCHAR | Game identifier |
| team_id | VARCHAR | Team identifier |
| period | VARCHAR | Period name or 'FullGame' |
| minutes | VARCHAR | '12:00' for periods, NULL for FullGame |
| points | INTEGER | Sum of player points |
| rebounds | INTEGER | Sum of player rebounds |
| assists | INTEGER | Sum of player assists |
| steals | INTEGER | Sum of player steals |
| blocks | INTEGER | Sum of player blocks |
| turnovers | INTEGER | Sum of player turnovers |
| fg_made | INTEGER | Sum of field goals made |
| fg_attempted | INTEGER | Sum of field goals attempted |
| fg3_made | INTEGER | Sum of three-pointers made |
| fg3_attempted | INTEGER | Sum of three-pointers attempted |
| ft_made | INTEGER | Sum of free throws made |
| ft_attempted | INTEGER | Sum of free throws attempted |

## Changes from v1

| Aspect | v1 (`nba_box_scores`) | v2 (`nba_box_scores_v2`) |
|--------|----------------------|--------------------------|
| team_stats | Materialized table (DROP + CREATE TABLE AS) | View derived from box_scores |
| schedule | No season_year/season_type columns | Added season_year, season_type |
| box_scores | No primary key | Composite PK (game_id, entity_id, period) |
| Ingestion tracking | None | ingestion_log table |
| Data quality | None | data_quality_quarantine table |
| Loading | Full DROP + recreate | Idempotent CREATE IF NOT EXISTS |

## DDL Source of Truth

The canonical DDL for all tables is in `scripts/ingest/db/schema.ts`.
