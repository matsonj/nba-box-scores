import { useState } from 'react';
import { Game } from '@/app/types';
import { Schedule, Team } from '@/app/types/schema';
import BoxScore from './BoxScore';
import { useSchedule } from '@/context/ScheduleContext';
import { useBoxScoreByGameId } from '@/hooks/useBoxScore';

interface GameCardProps {
  game: Game;
}

interface ExtendedSchedule extends Schedule {
  homeTeam: Team;
  awayTeam: Team;
}

export default function GameCard({ game }: GameCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { scheduleData } = useSchedule();

  const { fetchBoxScore } = useBoxScoreByGameId();

  const handleExpandClick = async () => {
    if (!game.boxScoreLoaded && !loading) {
      try {
        setLoading(true);
        await fetchBoxScore(game.game_id);

        const gameInfo = scheduleData.find(game => game.game_id === game.game_id) as ExtendedSchedule;
        if (gameInfo) {
          game.homeTeam = gameInfo.homeTeam;
          game.awayTeam = gameInfo.awayTeam;
          game.boxScoreLoaded = true;
        }

        // Update game with box score data
        if (gameInfo.homeTeam && gameInfo.awayTeam) {
          game.homeTeam = gameInfo.homeTeam;
          game.awayTeam = gameInfo.awayTeam;
        }

        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch box score');
      } finally {
        setLoading(false);
      }
    }
    setIsExpanded(!isExpanded);
  };

  const homeTeamClass = game.home_team_score > game.away_team_score ? 'font-bold' : '';
  const awayTeamClass = game.away_team_score > game.home_team_score ? 'font-bold' : '';

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4 relative">
      <div className="flex justify-between items-center cursor-pointer" onClick={handleExpandClick}>
        <div className="flex-1">
          <div className={awayTeamClass}>
            {game.awayTeam.teamAbbreviation} {game.away_team_score}
          </div>
          <div className={homeTeamClass}>
            {game.homeTeam.teamAbbreviation} {game.home_team_score}
          </div>
        </div>
        <div className="flex items-center">
          <span className="text-sm text-gray-500 mr-2">{game.status}</span>
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded"
            onClick={(e) => {
              e.stopPropagation();
              handleExpandClick();
            }}
          >
            {isExpanded ? 'Hide' : 'Show'} Box Score
          </button>
        </div>
      </div>

      {loading && <div className="mt-4">Loading box score...</div>}
      {error && <div className="mt-4 text-red-500">Error: {error}</div>}
      
      {isExpanded && !loading && !error && game.boxScoreLoaded && (
        <div className="mt-4">
          <BoxScore homeTeam={game.homeTeam} awayTeam={game.awayTeam} />
        </div>
      )}
    </div>
  );
}
