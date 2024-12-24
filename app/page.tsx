'use client';

import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';
import { Schedule } from './types/schema';
import { ScheduleWithBoxScore } from './types/extended';

// Helper function to format period numbers
function formatPeriod(period: string, allPeriods: string[]): string {
  const periodNum = parseInt(period);
  if (periodNum <= 4) return period;
  
  // Get the maximum period number
  const maxPeriod = Math.max(...allPeriods.map(p => parseInt(p)));
  
  // If we only have one OT period (max is 5), just show "OT"
  if (maxPeriod === 5) return "OT";
  
  // Otherwise show OT1, OT2, etc.
  return `OT${periodNum - 4}`;
}

export default function Home() {
  const [gamesByDate, setGamesByDate] = useState<Record<string, ScheduleWithBoxScore[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchGames = async () => {
      try {
        // Fetch schedule and box scores in parallel
        console.log('Fetching data...');
        const [scheduleResponse, boxScoresResponse] = await Promise.all([
          fetch('/api/schedule'),
          fetch('/api/box-scores/all')
        ]);

        if (!scheduleResponse.ok) {
          throw new Error('Failed to fetch schedule');
        }
        if (!boxScoresResponse.ok) {
          throw new Error('Failed to fetch box scores');
        }

        const [scheduleData, boxScoresData] = await Promise.all([
          scheduleResponse.json(),
          boxScoresResponse.json()
        ]);

        console.log('Data fetched:', {
          scheduleCount: scheduleData.length,
          boxScoresCount: Object.keys(boxScoresData).length
        });
        
        // Combine schedule with box scores
        const gamesWithBoxScores = scheduleData.map((game: Schedule) => ({
          ...game,
          boxScoreLoaded: !!boxScoresData[game.game_id],
          periodScores: boxScoresData[game.game_id] || []
        }));
        
        // Group games by date
        console.log('Grouping games by date...');
        const games: Record<string, ScheduleWithBoxScore[]> = {};
        gamesWithBoxScores.forEach((game: ScheduleWithBoxScore) => {
          if (!game.game_date) {
            console.error('Game date is missing:', game);
            return;
          }
          const gameDate = format(parseISO(game.game_date.toString()), 'yyyy-MM-dd');
          if (!games[gameDate]) {
            games[gameDate] = [];
          }
          games[gameDate].push(game);
        });
        console.log('Games grouped by date');

        setGamesByDate(games);
        setError('');
      } catch (err) {
        console.error('Error in fetchGames:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch games');
      } finally {
        setLoading(false);
      }
    };

    fetchGames();
  }, []);

  if (loading) {
    return <div className="p-8">Loading schedule...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 font-mono">
      <h1 className="text-3xl font-bold mb-8 text-center">NBA Schedule</h1>
      {Object.entries(gamesByDate)
        .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
        .map(([date, games]) => (
          <div key={date} className="mb-8">
            <h2 className="text-xl font-semibold mb-4">
              {format(parseISO(date), 'MMMM d, yyyy')}
            </h2>
            {games.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
                {games.map((game) => (
                  <Link
                    key={game.game_id}
                    href={`/game/${game.game_id}`}
                    className="block"
                  >
                    <div className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow">
                      {/* Period scores */}
                      {game.boxScoreLoaded && game.periodScores && (() => {
                        const periodScores = game.periodScores;
                        const uniquePeriods = Array.from(new Set(periodScores.map(ps => ps.period)));
                        return (
                        <div className="w-full">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-gray-600">
                                <th className="text-left">Team</th>
                                {uniquePeriods.map(period => (
                                  <th key={period} className="text-center w-8">
                                    {formatPeriod(period, uniquePeriods)}
                                  </th>
                                ))}
                                <th className="text-center w-8">T</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td className="text-left">{game.away_team_abbreviation}</td>
                                {uniquePeriods.sort((a, b) => parseInt(a) - parseInt(b)).map(period => (
                                  <td key={period} className="text-center">
                                    {periodScores.find(ps => parseInt(ps.period) === parseInt(period) && ps.teamId === game.away_team_id)?.points || '-'}
                                  </td>
                                ))}
                                <td className="text-center font-semibold">{game.away_team_score}</td>
                              </tr>
                              <tr>
                                <td className="text-left">{game.home_team_abbreviation}</td>
                                {uniquePeriods.sort((a, b) => parseInt(a) - parseInt(b)).map(period => (
                                  <td key={period} className="text-center">
                                    {periodScores.find(ps => parseInt(ps.period) === parseInt(period) && ps.teamId === game.home_team_id)?.points || '-'}
                                  </td>
                                ))}
                                <td className="text-center font-semibold">{game.home_team_score}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        );
                      })()}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-gray-500 text-center py-4">No games</div>
            )}
          </div>
        ))}
    </div>
  );
}
