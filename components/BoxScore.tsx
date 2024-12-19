import { useEffect, useState } from 'react';
import { GameInfo } from '@/types';

interface BoxScoreProps {
  gameId: string;
}

interface PlayerStats {
  player_name: string;
  team_abbreviation: string;
  minutes: number;
  field_goals_made: number;
  field_goals_attempted: number;
  three_pointers_made: number;
  three_pointers_attempted: number;
  free_throws_made: number;
  free_throws_attempted: number;
  offensive_rebounds: number;
  defensive_rebounds: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  personal_fouls: number;
  points: number;
}

interface TeamStats {
  team_abbreviation: string;
  points: number;
  field_goals_made: number;
  field_goals_attempted: number;
  three_pointers_made: number;
  three_pointers_attempted: number;
  free_throws_made: number;
  free_throws_attempted: number;
  offensive_rebounds: number;
  defensive_rebounds: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  personal_fouls: number;
  offensive_possessions: number;
  defensive_possessions: number;
}

interface BoxScoreData {
  gameInfo: GameInfo;
  playerStats: PlayerStats[];
  teamStats: TeamStats[];
}

export default function BoxScore({ gameId }: BoxScoreProps) {
  const [boxScore, setBoxScore] = useState<BoxScoreData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBoxScore = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/box-scores/${gameId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch box score');
        }
        const data = await response.json();
        setBoxScore(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setBoxScore(null);
      } finally {
        setLoading(false);
      }
    };

    if (gameId) {
      fetchBoxScore();
    }
  }, [gameId]);

  if (loading) {
    return <div className="p-4">Loading box score...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>;
  }

  if (!boxScore) {
    return <div className="p-4">No box score data available</div>;
  }

  const { gameInfo, playerStats, teamStats } = boxScore;
  const homeTeamPlayers = playerStats.filter(
    (player) => player.team_abbreviation === gameInfo.home_team_abbreviation
  );
  const awayTeamPlayers = playerStats.filter(
    (player) => player.team_abbreviation === gameInfo.away_team_abbreviation
  );

  const renderPlayerRow = (player: PlayerStats) => (
    <tr key={player.player_name} className="border-b">
      <td className="p-2">{player.player_name}</td>
      <td className="p-2">{player.minutes}</td>
      <td className="p-2">{`${player.field_goals_made}-${player.field_goals_attempted}`}</td>
      <td className="p-2">{`${player.three_pointers_made}-${player.three_pointers_attempted}`}</td>
      <td className="p-2">{`${player.free_throws_made}-${player.free_throws_attempted}`}</td>
      <td className="p-2">{player.rebounds}</td>
      <td className="p-2">{player.assists}</td>
      <td className="p-2">{player.steals}</td>
      <td className="p-2">{player.blocks}</td>
      <td className="p-2">{player.turnovers}</td>
      <td className="p-2">{player.personal_fouls}</td>
      <td className="p-2">{player.points}</td>
    </tr>
  );

  const renderTeamStats = (team: TeamStats) => (
    <tr key={team.team_abbreviation} className="font-bold bg-gray-100">
      <td className="p-2">Team Totals</td>
      <td className="p-2">240</td>
      <td className="p-2">{`${team.field_goals_made}-${team.field_goals_attempted}`}</td>
      <td className="p-2">{`${team.three_pointers_made}-${team.three_pointers_attempted}`}</td>
      <td className="p-2">{`${team.free_throws_made}-${team.free_throws_attempted}`}</td>
      <td className="p-2">{team.rebounds}</td>
      <td className="p-2">{team.assists}</td>
      <td className="p-2">{team.steals}</td>
      <td className="p-2">{team.blocks}</td>
      <td className="p-2">{team.turnovers}</td>
      <td className="p-2">{team.personal_fouls}</td>
      <td className="p-2">{team.points}</td>
    </tr>
  );

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">
        {gameInfo.away_team_abbreviation} @ {gameInfo.home_team_abbreviation}
      </h2>
      
      {/* Away Team Box Score */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-2">{gameInfo.away_team_abbreviation}</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white">
            <thead>
              <tr className="bg-gray-200">
                <th className="p-2 text-left">Player</th>
                <th className="p-2">MIN</th>
                <th className="p-2">FG</th>
                <th className="p-2">3PT</th>
                <th className="p-2">FT</th>
                <th className="p-2">REB</th>
                <th className="p-2">AST</th>
                <th className="p-2">STL</th>
                <th className="p-2">BLK</th>
                <th className="p-2">TO</th>
                <th className="p-2">PF</th>
                <th className="p-2">PTS</th>
              </tr>
            </thead>
            <tbody>
              {awayTeamPlayers.map(renderPlayerRow)}
              {renderTeamStats(
                teamStats.find(
                  (team) => team.team_abbreviation === gameInfo.away_team_abbreviation
                )!
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Home Team Box Score */}
      <div>
        <h3 className="text-lg font-semibold mb-2">{gameInfo.home_team_abbreviation}</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white">
            <thead>
              <tr className="bg-gray-200">
                <th className="p-2 text-left">Player</th>
                <th className="p-2">MIN</th>
                <th className="p-2">FG</th>
                <th className="p-2">3PT</th>
                <th className="p-2">FT</th>
                <th className="p-2">REB</th>
                <th className="p-2">AST</th>
                <th className="p-2">STL</th>
                <th className="p-2">BLK</th>
                <th className="p-2">TO</th>
                <th className="p-2">PF</th>
                <th className="p-2">PTS</th>
              </tr>
            </thead>
            <tbody>
              {homeTeamPlayers.map(renderPlayerRow)}
              {renderTeamStats(
                teamStats.find(
                  (team) => team.team_abbreviation === gameInfo.home_team_abbreviation
                )!
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
