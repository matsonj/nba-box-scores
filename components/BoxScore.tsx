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
                <th className="md:px-4 md:py-2 p-1 text-left md:text-base text-xs">Player</th>
                <th className="md:px-4 md:py-2 p-1 text-right md:text-base text-xs">MIN</th>
                <th className="md:px-4 md:py-2 p-1 text-right md:text-base text-xs">PTS</th>
                <th className="md:px-4 md:py-2 p-1 text-right md:text-base text-xs">REB</th>
                <th className="md:px-4 md:py-2 p-1 text-right md:text-base text-xs">AST</th>
                <th className="md:px-4 md:py-2 p-1 text-right md:text-base text-xs">STL</th>
                <th className="md:px-4 md:py-2 p-1 text-right md:text-base text-xs">BLK</th>
                <th className="md:px-4 md:py-2 p-1 text-right md:text-base text-xs">TO</th>
                <th className="md:px-4 md:py-2 p-1 text-right md:text-base text-xs">FG</th>
                <th className="md:px-4 md:py-2 p-1 text-right md:text-base text-xs">3P</th>
                <th className="md:px-4 md:py-2 p-1 text-right md:text-base text-xs">FT</th>
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map((player, index) => (
                <tr key={player.playerName} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="md:px-4 md:py-2 p-1 md:text-base text-xs">{player.playerName}</td>
                  <td className="md:px-4 md:py-2 p-1 text-right md:text-base text-xs">{player.minutes}</td>
                  <td className="md:px-4 md:py-2 p-1 text-right md:text-base text-xs">{player.points}</td>
                  <td className="md:px-4 md:py-2 p-1 text-right md:text-base text-xs">{player.rebounds}</td>
                  <td className="md:px-4 md:py-2 p-1 text-right md:text-base text-xs">{player.assists}</td>
                  <td className="md:px-4 md:py-2 p-1 text-right md:text-base text-xs">{player.steals}</td>
                  <td className="md:px-4 md:py-2 p-1 text-right md:text-base text-xs">{player.blocks}</td>
                  <td className="md:px-4 md:py-2 p-1 text-right md:text-base text-xs">{player.turnovers}</td>
                  <td className="md:px-4 md:py-2 p-1 text-right md:text-base text-xs">{player.fieldGoalsMade}-{player.fieldGoalsAttempted}</td>
                  <td className="md:px-4 md:py-2 p-1 text-right md:text-base text-xs">{player.threePointersMade}-{player.threePointersAttempted}</td>
                  <td className="md:px-4 md:py-2 p-1 text-right md:text-base text-xs">{player.freeThrowsMade}-{player.freeThrowsAttempted}</td>
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
