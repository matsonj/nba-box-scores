export type { Sport, SportConfig } from './types';
export { nbaConfig } from './nba';
export { nhlConfig } from './nhl';

import type { Sport, SportConfig } from './types';
import { nbaConfig } from './nba';
import { nhlConfig } from './nhl';

const configs: Record<Sport, SportConfig> = {
  nba: nbaConfig,
  nhl: nhlConfig,
};

export function getSportConfig(sport: Sport): SportConfig {
  return configs[sport];
}
