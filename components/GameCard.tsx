import { useState } from 'react';
import axios from 'axios';
import { Game, PlayerStats } from '../types';
import BoxScore from './BoxScore';

interface GameCardProps {
  game: Game;
}

export default function GameCard({ game }: GameCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleExpandClick = async () => {
    if (!game.boxScoreLoaded && !loading) {
      try {
        setLoading(true);
        const response = await axios.get(
          'https://api.pbpstats.com/get-game-stats',
          {
            params: {
              GameId: game.gameId,
              Type: 'Player'
            }
          }
        );

        // Transform API response into our PlayerStats format
        const transformPlayerStats = (playerData: any): PlayerStats => ({
          name: playerData.name,
          minutes: playerData.minutes,
          points: parseInt(playerData.points || '0'),
          rebounds: parseInt(playerData.totReb || '0'),
          assists: parseInt(playerData.assists || '0'),
          steals: parseInt(playerData.steals || '0'),
          blocks: parseInt(playerData.blocks || '0'),
          turnovers: parseInt(playerData.turnovers || '0'),
          fieldGoalsMade: parseInt(playerData.fgm || '0'),
          fieldGoalsAttempted: parseInt(playerData.fga || '0'),
          threePointersMade: parseInt(playerData.tpm || '0'),
          threePointersAttempted: parseInt(playerData.tpa || '0'),
          freeThrowsMade: parseInt(playerData.ftm || '0'),
          freeThrowsAttempted: parseInt(playerData.fta || '0'),
          plusMinus: parseInt(playerData.plusMinus || '0'),
          starter: playerData.starter === '1'
        });

        // Update home team players
        game.homeTeam.players = Object.values(response.data.stats)
          .filter((player: any) => player.teamId === game.homeTeam.teamId)
          .map(transformPlayerStats);

        // Update away team players
        game.awayTeam.players = Object.values(response.data.stats)
          .filter((player: any) => player.teamId === game.awayTeam.teamId)
          .map(transformPlayerStats);

        game.boxScoreLoaded = true;
      } catch (err) {
        setError('Failed to load box score');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div 
        className="p-4 cursor-pointer hover:bg-gray-50"
        onClick={handleExpandClick}
      >
        <div className="flex justify-between items-center">
          <div className="flex-1">
            <p className="font-semibold">{game.awayTeam.teamName}</p>
            <p className="text-gray-600">{game.awayTeam.score}</p>
          </div>
          <div className="px-4 text-center">
            <p className="text-sm text-gray-500">
              {game.gameStatus === 'Final' ? 'Final' : game.clock}
            </p>
            {game.gameStatus !== 'Final' && (
              <p className="text-xs text-gray-400">Q{game.period}</p>
            )}
          </div>
          <div className="flex-1 text-right">
            <p className="font-semibold">{game.homeTeam.teamName}</p>
            <p className="text-gray-600">{game.homeTeam.score}</p>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-200 p-4">
          {loading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-500 border-t-transparent"></div>
            </div>
          ) : error ? (
            <div className="text-red-500 text-center py-4">{error}</div>
          ) : (
            <BoxScore homeTeam={game.homeTeam} awayTeam={game.awayTeam} />
          )}
        </div>
      )}
    </div>
  );
}
