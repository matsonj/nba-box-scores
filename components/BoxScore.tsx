'use client';

import { Team } from '@/app/types/schema';

interface BoxScoreProps {
  homeTeam: Team;
  awayTeam: Team;
}

export default function BoxScore({ homeTeam, awayTeam }: BoxScoreProps) {
  const renderTeamStats = (team: Team) => {
    if (!team.players || team.players.length === 0) {
      return <div>No player stats available</div>;
    }

    // Sort players by minutes played (descending)
    const sortedPlayers = [...team.players].sort((a, b) => {
      // Convert minutes string (e.g., "12:34") to total seconds for comparison
      const getSeconds = (min: string) => {
        if (!min) return 0;
        const [minutes, seconds] = min.split(':').map(Number);
        return (minutes || 0) * 60 + (seconds || 0);
      };
      return getSeconds(b.minutes) - getSeconds(a.minutes);
    });

    return (
      <div>
        <h3 className="font-bold text-lg mb-2">{team.teamName}</h3>
        <div className="overflow-x-auto relative">
          <table className="min-w-full table-auto">
            <thead className="bg-white sticky top-0 z-10">
              <tr className="bg-gray-100">
                <th className="px-4 py-2 text-left">Player</th>
                <th className="px-4 py-2 text-right">MIN</th>
                <th className="px-4 py-2 text-right">PTS</th>
                <th className="px-4 py-2 text-right">REB</th>
                <th className="px-4 py-2 text-right">AST</th>
                <th className="px-4 py-2 text-right">STL</th>
                <th className="px-4 py-2 text-right">BLK</th>
                <th className="px-4 py-2 text-right">TO</th>
                <th className="px-4 py-2 text-right">FG</th>
                <th className="px-4 py-2 text-right">3P</th>
                <th className="px-4 py-2 text-right">FT</th>
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map((player, index) => (
                <tr key={player.playerName} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-2">{player.playerName}</td>
                  <td className="px-4 py-2 text-right">{player.minutes}</td>
                  <td className="px-4 py-2 text-right">{player.points}</td>
                  <td className="px-4 py-2 text-right">{player.rebounds}</td>
                  <td className="px-4 py-2 text-right">{player.assists}</td>
                  <td className="px-4 py-2 text-right">{player.steals}</td>
                  <td className="px-4 py-2 text-right">{player.blocks}</td>
                  <td className="px-4 py-2 text-right">{player.turnovers}</td>
                  <td className="px-4 py-2 text-right">{player.fieldGoalsMade}-{player.fieldGoalsAttempted}</td>
                  <td className="px-4 py-2 text-right">{player.threePointersMade}-{player.threePointersAttempted}</td>
                  <td className="px-4 py-2 text-right">{player.freeThrowsMade}-{player.freeThrowsAttempted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {renderTeamStats(awayTeam)}
      {renderTeamStats(homeTeam)}
    </div>
  );
}
