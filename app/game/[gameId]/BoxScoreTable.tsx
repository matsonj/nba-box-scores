'use client';

interface PlayerStats {
  entityId: string;
  playerName: string;
  minutes: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  threePointersMade: number;
  threePointersAttempted: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  plusMinus: number;
  starter: boolean;
}

interface BoxScoreTableProps {
  players: PlayerStats[];
  teamName: string;
}

function calculatePercentage(made: number, attempted: number): string {
  if (attempted === 0) return '.000';
  const percentage = made / attempted;
  return percentage >= 1 ? '1.000' : percentage.toFixed(3).substring(1);
}

function parseMinutes(timeStr: string): number {
  const [minutes, seconds] = timeStr.split(':').map(Number);
  return minutes * 60 + seconds;
}

function formatMinutes(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function calculateTeamTotals(players: PlayerStats[]) {
  const totals = players.reduce((acc, player) => {
    const minutes = parseMinutes(player.minutes);
    return {
      minutes: acc.minutes + minutes,
      points: acc.points + player.points,
      rebounds: acc.rebounds + player.rebounds,
      assists: acc.assists + player.assists,
      steals: acc.steals + player.steals,
      blocks: acc.blocks + player.blocks,
      turnovers: acc.turnovers + player.turnovers,
      fieldGoalsMade: acc.fieldGoalsMade + player.fieldGoalsMade,
      fieldGoalsAttempted: acc.fieldGoalsAttempted + player.fieldGoalsAttempted,
      threePointersMade: acc.threePointersMade + player.threePointersMade,
      threePointersAttempted: acc.threePointersAttempted + player.threePointersAttempted,
      freeThrowsMade: acc.freeThrowsMade + player.freeThrowsMade,
      freeThrowsAttempted: acc.freeThrowsAttempted + player.freeThrowsAttempted,
    };
  }, {
    minutes: 0,
    points: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    threePointersMade: 0,
    threePointersAttempted: 0,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
  });

  return {
    ...totals,
    minutes: formatMinutes(totals.minutes),
  };
}

export default function BoxScoreTable({ players, teamName }: BoxScoreTableProps) {
  return (
    <div className="mb-8 print:mb-4">
      <h2 className="text-xl font-bold mb-4 print:text-lg print:mb-2">{teamName}</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto print:text-xs">
          <thead>
            <tr className="bg-gray-200 print:bg-transparent print:border-b">
              <th className="px-3 py-1 text-left print:px-2">Player</th>
              <th className="px-3 py-1 text-right print:px-2">MIN</th>
              <th className="px-3 py-1 text-right print:px-2">PTS</th>
              <th className="px-3 py-1 text-right print:px-2">REB</th>
              <th className="px-3 py-1 text-right print:px-2">AST</th>
              <th className="px-3 py-1 text-right print:px-2">STL</th>
              <th className="px-3 py-1 text-right print:px-2">BLK</th>
              <th className="px-3 py-1 text-right print:px-2">TO</th>
              <th className="px-3 py-1 text-right print:px-2">FG</th>
              <th className="px-3 py-1 text-right print:px-2">FG%</th>
              <th className="px-3 py-1 text-right print:px-2">3P</th>
              <th className="px-3 py-1 text-right print:px-2">3P%</th>
              <th className="px-3 py-1 text-right print:px-2">FT</th>
              <th className="px-3 py-1 text-right print:px-2">FT%</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.entityId} className="border-b print:border-dotted">
                <td className="px-3 py-1 print:px-2 print:py-0.5">{player.playerName}{player.starter ? ' *' : ''}</td>
                <td className="px-3 py-1 text-right print:px-2 print:py-0.5">{player.minutes}</td>
                <td className="px-3 py-1 text-right print:px-2 print:py-0.5">{player.points}</td>
                <td className="px-3 py-1 text-right print:px-2 print:py-0.5">{player.rebounds}</td>
                <td className="px-3 py-1 text-right print:px-2 print:py-0.5">{player.assists}</td>
                <td className="px-3 py-1 text-right print:px-2 print:py-0.5">{player.steals}</td>
                <td className="px-3 py-1 text-right print:px-2 print:py-0.5">{player.blocks}</td>
                <td className="px-3 py-1 text-right print:px-2 print:py-0.5">{player.turnovers}</td>
                <td className="px-3 py-1 text-right print:px-2 print:py-0.5">
                  {player.fieldGoalsMade}-{player.fieldGoalsAttempted}
                </td>
                <td className="px-3 py-1 text-right print:px-2 print:py-0.5">
                  {calculatePercentage(player.fieldGoalsMade, player.fieldGoalsAttempted)}
                </td>
                <td className="px-3 py-1 text-right print:px-2 print:py-0.5">
                  {player.threePointersMade}-{player.threePointersAttempted}
                </td>
                <td className="px-3 py-1 text-right print:px-2 print:py-0.5">
                  {calculatePercentage(player.threePointersMade, player.threePointersAttempted)}
                </td>
                <td className="px-3 py-1 text-right print:px-2 print:py-0.5">
                  {player.freeThrowsMade}-{player.freeThrowsAttempted}
                </td>
                <td className="px-3 py-1 text-right print:px-2 print:py-0.5">
                  {calculatePercentage(player.freeThrowsMade, player.freeThrowsAttempted)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 font-bold print:border-t print:text-xs">
              <td className="px-3 py-1 print:px-2 print:py-0.5">Team Totals</td>
              <td className="px-3 py-1 text-right print:px-2 print:py-0.5">{calculateTeamTotals(players).minutes}</td>
              <td className="px-3 py-1 text-right print:px-2 print:py-0.5">{calculateTeamTotals(players).points}</td>
              <td className="px-3 py-1 text-right print:px-2 print:py-0.5">{calculateTeamTotals(players).rebounds}</td>
              <td className="px-3 py-1 text-right print:px-2 print:py-0.5">{calculateTeamTotals(players).assists}</td>
              <td className="px-3 py-1 text-right print:px-2 print:py-0.5">{calculateTeamTotals(players).steals}</td>
              <td className="px-3 py-1 text-right print:px-2 print:py-0.5">{calculateTeamTotals(players).blocks}</td>
              <td className="px-3 py-1 text-right print:px-2 print:py-0.5">{calculateTeamTotals(players).turnovers}</td>
              <td className="px-3 py-1 text-right print:px-2 print:py-0.5">
                {calculateTeamTotals(players).fieldGoalsMade}-{calculateTeamTotals(players).fieldGoalsAttempted}
              </td>
              <td className="px-3 py-1 text-right print:px-2 print:py-0.5">
                {calculatePercentage(calculateTeamTotals(players).fieldGoalsMade, calculateTeamTotals(players).fieldGoalsAttempted)}
              </td>
              <td className="px-3 py-1 text-right print:px-2 print:py-0.5">
                {calculateTeamTotals(players).threePointersMade}-{calculateTeamTotals(players).threePointersAttempted}
              </td>
              <td className="px-3 py-1 text-right print:px-2 print:py-0.5">
                {calculatePercentage(calculateTeamTotals(players).threePointersMade, calculateTeamTotals(players).threePointersAttempted)}
              </td>
              <td className="px-3 py-1 text-right print:px-2 print:py-0.5">
                {calculateTeamTotals(players).freeThrowsMade}-{calculateTeamTotals(players).freeThrowsAttempted}
              </td>
              <td className="px-3 py-1 text-right print:px-2 print:py-0.5">
                {calculatePercentage(calculateTeamTotals(players).freeThrowsMade, calculateTeamTotals(players).freeThrowsAttempted)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
