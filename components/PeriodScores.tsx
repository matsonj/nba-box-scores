'use client';

interface PeriodScore {
  teamId: string;
  period: string;
  points: number;
}

interface PeriodScoresProps {
  homeTeamId: string;
  awayTeamId: string;
  homeTeamAbbreviation: string;
  awayTeamAbbreviation: string;
  periodScores: PeriodScore[];
  homeTeamScore: number;
  awayTeamScore: number;
}

export default function PeriodScores({
  homeTeamId,
  awayTeamId,
  homeTeamAbbreviation,
  awayTeamAbbreviation,
  periodScores,
  homeTeamScore,
  awayTeamScore,
}: PeriodScoresProps) {
  return (
    <div className="mb-4">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100 dark:bg-gray-700">
            <th className="py-2 px-4 text-left dark:text-gray-200">Team</th>
            {['1', '2', '3', '4'].map(period => (
              <th key={period} className="py-2 px-4 text-center dark:text-gray-200">{period}</th>
            ))}
            <th className="py-2 px-4 text-center dark:text-gray-200">T</th>
          </tr>
        </thead>
        <tbody>
          {[
            { teamId: awayTeamId, abbrev: awayTeamAbbreviation, score: awayTeamScore },
            { teamId: homeTeamId, abbrev: homeTeamAbbreviation, score: homeTeamScore }
          ].map(team => (
            <tr key={team.teamId} className="border-t dark:border-gray-700">
              <td className="py-2 px-4 font-medium dark:text-gray-200">{team.abbrev}</td>
              {['1', '2', '3', '4'].map(period => {
                const score = periodScores.find(
                  s => s.teamId === team.teamId && s.period === period
                );
                return (
                  <td key={period} className="py-2 px-4 text-center dark:text-gray-200">
                    {score?.points || '-'}
                  </td>
                );
              })}
              <td className="py-2 px-4 text-center font-bold dark:text-gray-200">{team.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
