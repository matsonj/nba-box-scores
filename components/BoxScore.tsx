'use client';

import { Team } from '@/app/types/schema';
import type { CellState } from '@/app/types/live';

interface BoxScoreProps {
  homeTeam: Team;
  awayTeam: Team;
  onPlayerClick?: (entityId: string, playerName: string) => void;
  highlightedCells?: Map<string, CellState>;
  boldedCells?: Map<string, CellState>;
}

function getCellClasses(
  playerId: string,
  field: string,
  highlightedCells?: Map<string, CellState>,
  boldedCells?: Map<string, CellState>,
): string {
  if (!highlightedCells && !boldedCells) return '';

  const key = `${playerId}:${field}`;
  const classes: string[] = [];

  const hState = highlightedCells?.get(key);
  if (hState === 'active') classes.push('live-highlight-active');
  else if (hState === 'fading') classes.push('live-highlight-fading');

  const bState = boldedCells?.get(key);
  if (bState === 'active') classes.push('live-bold-active');
  else if (bState === 'fading') classes.push('live-bold-fading');

  return classes.join(' ');
}

// For combined cells (FG, 3P, FT), highlight if either made or attempted changed
function getCombinedCellClasses(
  playerId: string,
  madeField: string,
  attemptedField: string,
  highlightedCells?: Map<string, CellState>,
  boldedCells?: Map<string, CellState>,
): string {
  if (!highlightedCells && !boldedCells) return '';

  const madeKey = `${playerId}:${madeField}`;
  const attemptedKey = `${playerId}:${attemptedField}`;
  const classes: string[] = [];

  const hMade = highlightedCells?.get(madeKey);
  const hAttempted = highlightedCells?.get(attemptedKey);
  const hState = hMade === 'active' || hAttempted === 'active'
    ? 'active'
    : hMade === 'fading' || hAttempted === 'fading'
      ? 'fading'
      : null;

  if (hState === 'active') classes.push('live-highlight-active');
  else if (hState === 'fading') classes.push('live-highlight-fading');

  const bMade = boldedCells?.get(madeKey);
  const bAttempted = boldedCells?.get(attemptedKey);
  const bState = bMade === 'active' || bAttempted === 'active'
    ? 'active'
    : bMade === 'fading' || bAttempted === 'fading'
      ? 'fading'
      : null;

  if (bState === 'active') classes.push('live-bold-active');
  else if (bState === 'fading') classes.push('live-bold-fading');

  return classes.join(' ');
}

export default function BoxScore({ homeTeam, awayTeam, onPlayerClick, highlightedCells, boldedCells }: BoxScoreProps) {
  const isLive = !!(highlightedCells || boldedCells);

  const renderTeamStats = (team: Team) => {
    if (!team.players || team.players.length === 0) {
      return <div>No player stats available</div>;
    }

    // In live mode, only show players who have played
    const activePlayers = isLive
      ? team.players.filter(p => p.played === true)
      : team.players;

    // Sort players by minutes played (descending)
    const sortedPlayers = [...activePlayers].sort((a, b) => {
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
          <table className="min-w-full table-fixed tabular-nums">
            <colgroup>
              <col className="w-[28%]" />
              <col className="w-[7%]" />
              <col className="w-[5%]" />
              <col className="w-[5%]" />
              <col className="w-[5%]" />
              <col className="w-[5%]" />
              <col className="w-[5%]" />
              <col className="w-[5%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-700">
                <th className="md:px-2 md:py-0.5 p-0.5 text-left md:text-base text-xs dark:text-gray-200 bg-transparent">Player</th>
                <th className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">MIN</th>
                <th className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">PTS</th>
                <th className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">REB</th>
                <th className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">AST</th>
                <th className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">STL</th>
                <th className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">BLK</th>
                <th className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">TO</th>
                <th className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">FG</th>
                <th className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">3P</th>
                <th className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent">FT</th>
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map((player, index) => (
                <tr key={player.playerName} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}>
                  <td
                    className={`md:px-2 md:py-0.5 p-0.5 md:text-base text-xs dark:text-gray-200${onPlayerClick ? ' cursor-pointer hover:text-blue-600 dark:hover:text-blue-400' : ''}${isLive && player.oncourt ? ' font-bold' : ''}`}
                    onClick={() => onPlayerClick?.(player.playerId, player.playerName)}
                  >{player.playerName}{isLive && player.oncourt ? ' *' : ''}</td>
                  <td className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200">
                    <span className={getCellClasses(player.playerId, 'minutes', highlightedCells, boldedCells)}>
                      {player.minutes || '0:00'}
                    </span>
                  </td>
                  <td className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200">
                    <span className={getCellClasses(player.playerId, 'points', highlightedCells, boldedCells)}>
                      {player.points}
                    </span>
                  </td>
                  <td className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200">
                    <span className={getCellClasses(player.playerId, 'rebounds', highlightedCells, boldedCells)}>
                      {player.rebounds}
                    </span>
                  </td>
                  <td className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200">
                    <span className={getCellClasses(player.playerId, 'assists', highlightedCells, boldedCells)}>
                      {player.assists}
                    </span>
                  </td>
                  <td className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200">
                    <span className={getCellClasses(player.playerId, 'steals', highlightedCells, boldedCells)}>
                      {player.steals}
                    </span>
                  </td>
                  <td className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200">
                    <span className={getCellClasses(player.playerId, 'blocks', highlightedCells, boldedCells)}>
                      {player.blocks}
                    </span>
                  </td>
                  <td className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200">
                    <span className={getCellClasses(player.playerId, 'turnovers', highlightedCells, boldedCells)}>
                      {player.turnovers}
                    </span>
                  </td>
                  <td className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200">
                    <span className={getCombinedCellClasses(player.playerId, 'fieldGoalsMade', 'fieldGoalsAttempted', highlightedCells, boldedCells)}>
                      {player.fieldGoalsMade}-{player.fieldGoalsAttempted}
                    </span>
                  </td>
                  <td className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200">
                    <span className={getCombinedCellClasses(player.playerId, 'threePointersMade', 'threePointersAttempted', highlightedCells, boldedCells)}>
                      {player.threePointersMade}-{player.threePointersAttempted}
                    </span>
                  </td>
                  <td className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200">
                    <span className={getCombinedCellClasses(player.playerId, 'freeThrowsMade', 'freeThrowsAttempted', highlightedCells, boldedCells)}>
                      {player.freeThrowsMade}-{player.freeThrowsAttempted}
                    </span>
                  </td>
                </tr>
              ))}
              {/* Total Row */}
              <tr className="bg-blue-50 dark:bg-gray-600 font-bold">
                <td className="md:px-2 md:py-0.5 p-0.5 md:text-base text-xs dark:text-gray-200 font-bold">TOTAL</td>
                <td className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 font-bold">-</td>
                <td className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 font-bold">{totals.points}</td>
                <td className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 font-bold">{totals.rebounds}</td>
                <td className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 font-bold">{totals.assists}</td>
                <td className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 font-bold">{totals.steals}</td>
                <td className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 font-bold">{totals.blocks}</td>
                <td className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 font-bold">{totals.turnovers}</td>
                <td className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 font-bold">
                  {totals.fgMade}-{totals.fgAttempted}
                </td>
                <td className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 font-bold">
                  {totals.threePMade}-{totals.threePAttempted}
                </td>
                <td className="md:px-2 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 font-bold">
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
