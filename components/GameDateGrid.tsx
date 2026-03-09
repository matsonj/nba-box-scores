import { format, parseISO } from 'date-fns';
import GameCard from '@/components/GameCard';
import type { ScheduleWithBoxScore } from '@/app/types/extended';

interface GameDateGridProps {
  loading: boolean;
  paginatedDates: Array<{ date: string; games: ScheduleWithBoxScore[] }>;
  totalPages: number;
  currentPage: number;
  setCurrentPage: (fn: (p: number) => number) => void;
  onGameSelect: (id: string) => void;
  regularPeriods?: number;
  maxPeriods?: number;
}

export default function GameDateGrid({
  loading,
  paginatedDates,
  totalPages,
  currentPage,
  setCurrentPage,
  onGameSelect,
  regularPeriods,
  maxPeriods,
}: GameDateGridProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading games...</span>
      </div>
    );
  }

  return (
    <>
      {paginatedDates.map(({ date, games }) => {
        if (games.length === 0) return null;

        return (
          <div key={date} className="mb-8">
            <h2 className="text-xl font-bold mb-4">
              {format(parseISO(date), 'EEEE, MMMM do')}
            </h2>
            <div className="grid grid-cols-1 max-md:landscape:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
              {games.map((game) => (
                <div key={game.game_id}>
                  <GameCard
                    game={game}
                    onGameSelect={onGameSelect}
                    regularPeriods={regularPeriods}
                    maxPeriods={maxPeriods}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 py-6">
          <button
            onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className="px-4 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Page {currentPage + 1} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage >= totalPages - 1}
            className="px-4 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}
