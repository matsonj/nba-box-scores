import { ScheduleWithBoxScore } from '@/app/types/extended';
import { getPeriodsToShow, getPeriodLabel, getPeriodPoints } from '@/lib/periodUtils';

interface GameCardProps {
  game: ScheduleWithBoxScore;
  loading?: boolean;
  onGameSelect?: (gameId: string) => void;
}

export default function GameCard({ game, loading: isLoading, onGameSelect }: GameCardProps) {
  const periodsToShow = getPeriodsToShow(game.periodScores);

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-4 cursor-pointer hover:shadow-lg transition-shadow relative${
        game.isPlayoff ? ' border-l-4 border-amber-500' : ''
      }`}
      onClick={() => onGameSelect?.(game.game_id)}
    >

      {isLoading && (
        <div className="absolute inset-0 bg-white dark:bg-gray-800 bg-opacity-75 dark:bg-opacity-75 flex items-center justify-center rounded-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
        </div>
      )}

      {/* Period scores */}
      <div className="w-full">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-600 dark:text-gray-400">
              <th className="text-left">Team</th>
              {periodsToShow.map(period => (
                <th key={period} className="text-center w-8">
                  {getPeriodLabel(period)}
                </th>
              ))}
              <th className="text-center w-8">T</th>
            </tr>
          </thead>
          <tbody className="dark:text-gray-200">
            <tr>
              <td className="text-left">{game.away_team_abbreviation}</td>
              {periodsToShow.map(period => (
                <td key={period} className="text-center">
                  {getPeriodPoints(game.periodScores, period, game.away_team_abbreviation)}
                </td>
              ))}
              <td className="text-center font-semibold">{game.away_team_score}</td>
            </tr>
            <tr>
              <td className="text-left">{game.home_team_abbreviation}</td>
              {periodsToShow.map(period => (
                <td key={period} className="text-center">
                  {getPeriodPoints(game.periodScores, period, game.home_team_abbreviation)}
                </td>
              ))}
              <td className="text-center font-semibold">{game.home_team_score}</td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  );
}
