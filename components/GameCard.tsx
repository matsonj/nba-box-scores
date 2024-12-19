import { useState } from 'react';
import { Game } from '../types';
import BoxScore from './BoxScore';

interface GameCardProps {
  game: Game;
}

export default function GameCard({ game }: GameCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusText = () => {
    if (game.gameStatus === 'Final') return 'Final';
    if (game.gameStatus === 'Live') {
      return `Q${game.period} ${game.clock}`;
    }
    return new Date(game.startTime).toLocaleTimeString([], { 
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div 
        className="p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm text-gray-500">{getStatusText()}</span>
        </div>
        
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <span className="font-semibold">{game.awayTeam.teamName}</span>
            </div>
            <span className="text-xl font-bold">{game.awayTeam.score}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <span className="font-semibold">{game.homeTeam.teamName}</span>
            </div>
            <span className="text-xl font-bold">{game.homeTeam.score}</span>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-200 p-4">
          <BoxScore 
            homeTeam={game.homeTeam}
            awayTeam={game.awayTeam}
          />
        </div>
      )}
    </div>
  );
}
