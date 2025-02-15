'use client';

import { Team } from '@/app/types/schema';

interface BoxScoreProps {
  homeTeam: Team;
  awayTeam: Team;
}

import PeriodScores from './PeriodScores';

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
        <h3 className="font-bold text-lg mb-2 dark:text-white">{team.teamName}</h3>
        <div className="overflow-x-auto relative">
          <table className="min-w-full table-auto">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-700">
                <th className="md:px-4 md:py-2 p-1 text-left md:text-base text-xs dark:text-gray-200 bg-transparent">Player</th>
                <th className="md:px-4 md:py-2 p-1 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">MIN</th>
                <th className="md:px-4 md:py-2 p-1 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">PTS</th>
                <th className="md:px-4 md:py-2 p-1 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">REB</th>
                <th className="md:px-4 md:py-2 p-1 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">AST</th>
                <th className="md:px-4 md:py-2 p-1 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">STL</th>
                <th className="md:px-4 md:py-2 p-1 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">BLK</th>
                <th className="md:px-4 md:py-2 p-1 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">TO</th>
                <th className="md:px-4 md:py-2 p-1 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">FG</th>
                <th className="md:px-4 md:py-2 p-1 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">3P</th>
                <th className="md:px-4 md:py-2 p-1 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">FT</th>
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map((player, index) => (
                <tr key={player.playerName} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}>
                  <td className="md:px-4 md:py-2 p-1 md:text-base text-xs dark:text-gray-200">{player.playerName}</td>
                  <td className="md:px-4 md:py-2 p-1 text-right md:text-base text-xs dark:text-gray-200">{player.minutes || '0:00'}</td>
                  <td className="md:px-4 md:py-2 p-1 text-right md:text-base text-xs dark:text-gray-200">{player.points}</td>
                  <td className="md:px-4 md:py-2 p-1 text-right md:text-base text-xs dark:text-gray-200">{player.rebounds}</td>
                  <td className="md:px-4 md:py-2 p-1 text-right md:text-base text-xs dark:text-gray-200">{player.assists}</td>
                  <td className="md:px-4 md:py-2 p-1 text-right md:text-base text-xs dark:text-gray-200">{player.steals}</td>
                  <td className="md:px-4 md:py-2 p-1 text-right md:text-base text-xs dark:text-gray-200">{player.blocks}</td>
                  <td className="md:px-4 md:py-2 p-1 text-right md:text-base text-xs dark:text-gray-200">{player.turnovers}</td>
                  <td className="md:px-4 md:py-2 p-1 text-right md:text-base text-xs dark:text-gray-200">{player.fieldGoalsMade}-{player.fieldGoalsAttempted}</td>
                  <td className="md:px-4 md:py-2 p-1 text-right md:text-base text-xs dark:text-gray-200">{player.threePointersMade}-{player.threePointersAttempted}</td>
                  <td className="md:px-4 md:py-2 p-1 text-right md:text-base text-xs dark:text-gray-200">{player.freeThrowsMade}-{player.freeThrowsAttempted}</td>
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
      <PeriodScores
        homeTeamId={homeTeam.teamId}
        awayTeamId={awayTeam.teamId}
        homeTeamAbbreviation={homeTeam.teamAbbreviation}
        awayTeamAbbreviation={awayTeam.teamAbbreviation}
        periodScores={homeTeam.periodScores || []}
        homeTeamScore={homeTeam.score}
        awayTeamScore={awayTeam.score}
      />
      {renderTeamStats(awayTeam)}
      {renderTeamStats(homeTeam)}
    </div>
  );
}
