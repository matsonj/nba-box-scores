// Shared types for the data quality quarantine system

import type { MotherDuckConnection } from '../ingest/db/connection';

export interface QuarantineRecord {
  game_id: string;
  entity_id: string;
  player_name: string;
  expected_team: string | null;
  actual_team: string;
  detection_type: string;
  details: string | null;
}

export interface DetectorResult {
  name: string;
  found: number;
  inserted: number;
}

export interface Detector {
  name: string;
  run(db: MotherDuckConnection): Promise<DetectorResult>;
}
