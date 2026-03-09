import GameCard from '@/components/GameCard';
import type { LiveScoreGame } from '@/app/types/live';
import { liveGameToSchedule } from '@/lib/sportUtils';

interface LiveGamesSectionProps {
  games: LiveScoreGame[];
  onGameSelect: (id: string) => void;
  regularPeriods?: number;
  maxPeriods?: number;
}

export default function LiveGamesSection({ games, onGameSelect, regularPeriods, maxPeriods }: LiveGamesSectionProps) {
  if (games.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
        Live Games
      </h2>
      <div className="grid grid-cols-1 max-md:landscape:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
        {games.map((game) => (
          <div key={game.game_id}>
            <GameCard
              game={liveGameToSchedule(game)}
              onGameSelect={onGameSelect}
              regularPeriods={regularPeriods}
              maxPeriods={maxPeriods}
              liveStatus={{ period: game.period, clock: game.clock, status: game.status }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
