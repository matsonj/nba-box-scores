'use client';

import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';
import { Game } from './types';

export default function Home() {
  const [gamesByDate, setGamesByDate] = useState<Record<string, Game[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const response = await fetch('/api/schedule');
        if (!response.ok) {
          throw new Error('Failed to fetch schedule');
        }
        const data = await response.json();
        
        // Group games by date
        const games: Record<string, Game[]> = {};
        data.forEach((game: Game) => {
          const gameDate = format(parseISO(game.gameDate), 'yyyy-MM-dd');
          if (!games[gameDate]) {
            games[gameDate] = [];
          }
          games[gameDate].push(game);
        });

        setGamesByDate(games);
        setError('');
      } catch (err) {
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
    <main className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">NBA Schedule</h1>
      {Object.entries(gamesByDate)
        .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
        .map(([date, games]) => (
          <div key={date} className="mb-8">
            <h2 className="text-xl font-semibold mb-4">
              {format(parseISO(date), 'EEEE, MMMM d, yyyy')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {games.map((game) => (
                <Link
                  key={game.game_id}
                  href={`/game/${game.game_id}`}
                  className="block"
                >
                  <div className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow">
                    <div className="text-sm text-gray-600 mb-2">
                      {format(parseISO(game.gameDate), 'h:mm a')}
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <div className="font-semibold">{game.away_team_abbreviation}</div>
                        {game.status === 'Final' && (
                          <div className="text-lg">{game.away_team_score}</div>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">@</div>
                      <div className="text-right">
                        <div className="font-semibold">{game.home_team_abbreviation}</div>
                        {game.status === 'Final' && (
                          <div className="text-lg">{game.home_team_score}</div>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 text-center">
                      {game.status}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
    </main>
  );
}
