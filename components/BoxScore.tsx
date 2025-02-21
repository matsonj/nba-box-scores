'use client';

import { Team } from '@/app/types/schema';

interface BoxScoreProps {
  homeTeam: Team;
  awayTeam: Team;
  onPlayerClick?: (entityId: string, playerName: string) => void;
}

export default function BoxScore({ homeTeam, awayTeam, onPlayerClick }: BoxScoreProps) {
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

    // Calculate totals
    const totals = sortedPlayers.reduce((acc, player) => ({
      points: acc.points + (player.points || 0),
      rebounds: acc.rebounds + (player.rebounds || 0),
      assists: acc.assists + (player.assists || 0),
      steals: acc.steals + (player.steals || 0),
      blocks: acc.blocks + (player.blocks || 0),
      turnovers: acc.turnovers + (player.turnovers || 0),
      fgMade: acc.fgMade + (player.fieldGoalsMade || 0),
      fgAttempted: acc.fgAttempted + (player.fieldGoalsAttempted || 0),
      threePMade: acc.threePMade + (player.threePointersMade || 0),
      threePAttempted: acc.threePAttempted + (player.threePointersAttempted || 0),
      ftMade: acc.ftMade + (player.freeThrowsMade || 0),
      ftAttempted: acc.ftAttempted + (player.freeThrowsAttempted || 0)
    }), {
      points: 0,
      rebounds: 0,
      assists: 0,
      steals: 0,
      blocks: 0,
      turnovers: 0,
      fgMade: 0,
      fgAttempted: 0,
      threePMade: 0,
      threePAttempted: 0,
      ftMade: 0,
      ftAttempted: 0
    });

    return (
      <div>
        <h3 className="font-bold text-lg mb-1 dark:text-white">{team.teamName}</h3>
        <div className="w-full">
          <table className="min-w-full table-auto">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-700">
                <th className="md:px-1 md:py-0.5 p-0.5 text-left md:text-base text-xs dark:text-gray-200 bg-transparent">Player</th>
                <th className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">MIN</th>
                <th className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">PTS</th>
                <th className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">REB</th>
                <th className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">AST</th>
                <th className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">STL</th>
                <th className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">BLK</th>
                <th className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">TO</th>
                <th className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">FG</th>
                <th className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">3P</th>
                <th className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">FT</th>
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map((player, index) => (
                <tr key={player.playerName} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}>
                  <td 
                    className="md:px-1 md:py-0.5 p-0.5 md:text-base text-xs dark:text-gray-200 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                    onClick={() => onPlayerClick?.(player.playerId, player.playerName)}
                  >{player.playerName}</td>
                  <td className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200">{player.minutes || '0:00'}</td>
                  <td className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200">{player.points}</td>
                  <td className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200">{player.rebounds}</td>
                  <td className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200">{player.assists}</td>
                  <td className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200">{player.steals}</td>
                  <td className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200">{player.blocks}</td>
                  <td className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200">{player.turnovers}</td>
                  <td className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200">{player.fieldGoalsMade}-{player.fieldGoalsAttempted}</td>
                  <td className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200">{player.threePointersMade}-{player.threePointersAttempted}</td>
                  <td className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200">{player.freeThrowsMade}-{player.freeThrowsAttempted}</td>
                </tr>
              ))}
              {/* Total Row */}
              <tr className="bg-blue-50 dark:bg-gray-600 font-bold">
                <td className="md:px-1 md:py-0.5 p-0.5 md:text-base text-xs dark:text-gray-200 font-bold">TOTAL</td>
                <td className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 font-bold">-</td>
                <td className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 font-bold">{totals.points}</td>
                <td className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 font-bold">{totals.rebounds}</td>
                <td className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 font-bold">{totals.assists}</td>
                <td className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 font-bold">{totals.steals}</td>
                <td className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 font-bold">{totals.blocks}</td>
                <td className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 font-bold">{totals.turnovers}</td>
                <td className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 font-bold">
                  {totals.fgMade}-{totals.fgAttempted}
                </td>
                <td className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 font-bold">
                  {totals.threePMade}-{totals.threePAttempted}
                </td>
                <td className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 font-bold">
                  {totals.ftMade}-{totals.ftAttempted}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {renderTeamStats(awayTeam)}
      {renderTeamStats(homeTeam)}
    </div>
  );
}
