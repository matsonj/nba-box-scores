export interface PlayerIndexEntry {
  entity_id: string;
  player_name: string;
  team_abbreviation: string;
  game_ids: string[];
}

/** Builds a player search index from flat (player, game_id) rows, grouped client-side. */
export function buildPlayerIndex(
  rows: Array<{ entity_id: string; player_name: string; team_abbreviation: string; game_id: string }>
): PlayerIndexEntry[] {
  const map = new Map<string, PlayerIndexEntry>();
  for (const r of rows) {
    const key = `${r.entity_id}|${r.team_abbreviation}`;
    let entry = map.get(key);
    if (!entry) {
      entry = {
        entity_id: String(r.entity_id),
        player_name: String(r.player_name),
        team_abbreviation: String(r.team_abbreviation),
        game_ids: [],
      };
      map.set(key, entry);
    }
    entry.game_ids.push(String(r.game_id));
  }
  return Array.from(map.values());
}

/** Builds a Map of game_id -> period score entries from raw period score rows. */
export function buildGameScoresMap(
  periodScores: Array<{ game_id: string; team_abbreviation: string; period: string; points: number | string }>
): Map<string, Array<{ teamId: string; period: string; points: number }>> {
  const gameScores = new Map<string, Array<{ teamId: string; period: string; points: number }>>();

  const uniqueGameIds = new Set(periodScores.map(score => score.game_id));
  uniqueGameIds.forEach(gameId => {
    gameScores.set(gameId, []);
  });

  for (const score of periodScores) {
    const scores = gameScores.get(score.game_id)!;
    scores.push({
      teamId: score.team_abbreviation,
      period: score.period,
      points: Number(score.points),
    });
  }

  return gameScores;
}
