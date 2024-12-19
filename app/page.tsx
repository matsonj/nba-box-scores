'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { format, addDays, parseISO, isWithinInterval, startOfDay } from 'date-fns';
import GameCard from '../components/GameCard';
import { Game } from '../types';

export default function Home() {
  const [gamesByDate, setGamesByDate] = useState<Record<string, Game[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchGames = async () => {
      try {
        setLoading(true);
        const response = await axios.get(
          'https://data.nba.com/data/10s/v2015/json/mobile_teams/nba/2024/league/00_full_schedule.json'
        );

        // Get today and next two days
        const today = startOfDay(new Date());
        const twoDaysFromNow = addDays(today, 2);
        
        // Filter and organize games by date
        const newGamesByDate: Record<string, Game[]> = {};
        
        // Initialize empty arrays for the next three days
        for (let i = 0; i <= 2; i++) {
          const date = format(addDays(today, i), 'yyyy-MM-dd');
          newGamesByDate[date] = [];
        }

        // Process all months in the schedule
        response.data.lscd.forEach((month: any) => {
          month.mscd.g.forEach((game: any) => {
            const gameDate = game.gdte;
            const parsedGameDate = parseISO(gameDate);
            
            if (isWithinInterval(parsedGameDate, { start: today, end: twoDaysFromNow })) {
              // Transform the API response into our Game type
              const transformedGame: Game = {
                gameId: game.gid,
                startTime: game.etm, // Eastern time
                homeTeam: {
                  teamId: game.h.tid,
                  teamName: game.h.tn,
                  score: parseInt(game.h.s || '0'),
                  players: []
                },
                awayTeam: {
                  teamId: game.v.tid,
                  teamName: game.v.tn,
                  score: parseInt(game.v.s || '0'),
                  players: []
                },
                gameStatus: game.stt, // Game status text
                period: parseInt(game.p || '0'),
                clock: game.cl || ''
              };
              
              newGamesByDate[gameDate].push(transformedGame);
            }
          });
        });

        setGamesByDate(newGamesByDate);
      } catch (err) {
        setError('Failed to fetch games');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchGames();
    // Refresh every minute for live games
    const interval = setInterval(fetchGames, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen text-red-500">
        {error}
      </div>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">NBA Games</h1>
      {Object.entries(gamesByDate).map(([date, games]) => (
        <div key={date} className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            {format(parseISO(date), 'EEEE, MMMM d, yyyy')}
          </h2>
          {games.length === 0 ? (
            <p className="text-gray-500">No games scheduled for this day</p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {games.map((game) => (
                <GameCard key={game.gameId} game={game} />
              ))}
            </div>
          )}
        </div>
      ))}
    </main>
  );
}
