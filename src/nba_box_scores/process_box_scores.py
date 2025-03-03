"""Main script to process NBA box score files."""
from pathlib import Path

import duckdb

from nba_box_scores.box_score_parser import create_database_schema, process_game_file


def process_box_scores(data_dir: str | Path, db_path: str | Path) -> None:
    """Process all box score files in the data directory."""
    data_dir = Path(data_dir)
    db_path = Path(db_path)
    
    # Connect to DuckDB
    conn = duckdb.connect(str(db_path))
    
    try:
        # Create schema
        create_database_schema(conn)
        
        # Process all JSON files
        for file_path in data_dir.glob('*.json'):
            try:
                process_game_file(file_path, conn)
            except Exception as e:
                print(f"Failed to process {file_path.name}: {str(e)}")
                continue
    
    finally:
        conn.close()


if __name__ == '__main__':
    import sys
    
    if len(sys.argv) != 3:
        print("Usage: python -m nba_box_scores.process_box_scores <data_dir> <db_path>")
        sys.exit(1)
    
    process_box_scores(sys.argv[1], sys.argv[2])
