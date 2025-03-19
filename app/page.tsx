'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { ScheduleWithBoxScore } from './types/extended';
import BoxScorePanel from '@/components/BoxScorePanel';
import GameCard from '@/components/GameCard';
import { ScheduleProvider } from '@/context/ScheduleContext';
import { getTeamName } from '@/lib/teams';
import { useSchedule, useBoxScores } from '@/hooks/useGameData';
import { useDataLoader } from '@/lib/dataLoader';
import { FunnelIcon } from '@heroicons/react/24/outline';
import dynamic from 'next/dynamic';

// Dynamically import the DynamicTableLoader with no SSR
// This ensures it only loads on the client side after everything else
const DynamicTableLoader = dynamic(
  () => import('@/components/DynamicTableLoader'),
  { ssr: false }
);

function groupByDate(games: ScheduleWithBoxScore[]) {
  const gamesByDate: Record<string, ScheduleWithBoxScore[]> = {};
  games.forEach((game: ScheduleWithBoxScore) => {
    if (!game.game_date) {
      return;
    }
    // Ensure game_date is a Date object
    const gameDate = format(
      game.game_date instanceof Date ? game.game_date : parseISO(game.game_date as unknown as string),
      'yyyy-MM-dd'
    );
    if (!gamesByDate[gameDate]) {
      gamesByDate[gameDate] = [];
    }
    // Convert the date string to Date object before pushing
    gamesByDate[gameDate].push({
      ...game,
      game_date: game.game_date instanceof Date ? game.game_date : parseISO(game.game_date as unknown as string)
    });
  });
  return gamesByDate;
}

export default function Home() {
  const [gamesByDate, setGamesByDate] = useState<Record<string, ScheduleWithBoxScore[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadingGames] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [loadingMessages, setLoadingMessages] = useState<Array<{ message: string; completed: boolean }>>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string>();
  const dataLoader = useDataLoader();
  const { fetchSchedule } = useSchedule();
  const { fetchBoxScores } = useBoxScores();

  const filteredGamesByDate = useMemo(() => {
    if (!gamesByDate || Object.keys(gamesByDate).length === 0) return [];
    
    return Object.entries(
      groupByDate(
        Object.values(gamesByDate)
          .flat()
          .filter(game => 
            !selectedTeam || 
            game.home_team_abbreviation === selectedTeam ||
            game.away_team_abbreviation === selectedTeam
          )
      )
    ).map(([date, games]) => ({ date, games }));
  }, [gamesByDate, selectedTeam]);

  // Load all data when component mounts
  const initialLoadComplete = useRef(false);
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (initialLoadComplete.current) return;
    initialLoadComplete.current = true;

    const loadAllData = async () => {
      try {
        const updateLoadingMessage = (index: number) => {
          setLoadingMessages(prev => {
            const newMessages = [...prev];
            if (newMessages[index]) {
              newMessages[index] = { ...newMessages[index], completed: true };
            }
            return newMessages;
          });
        };

        // Add and complete loading steps one at a time
        const addLoadingMessage = (message: string) => {
          setLoadingMessages(prev => [...prev, { message, completed: false }]);
        };

        // Step 1: Load Wasm
        addLoadingMessage('Loading MotherDuck Wasm...');
        await dataLoader.waitForWasm();
        updateLoadingMessage(0);

        // Step 2: Initialize essential tables
        addLoadingMessage('Initializing essential tables...');
        await dataLoader.loadEssentialTables();
        updateLoadingMessage(1);
        
        // Clear any previous errors
        setError('');
        
        // Step 3: Fetch all game data
        addLoadingMessage('Fetching game data...');
        const [scheduleData, boxScoresData] = await Promise.all([
          fetchSchedule(),
          fetchBoxScores()
        ]);
        updateLoadingMessage(2);
        
        // Add a small delay before proceeding
        await new Promise(resolve => setTimeout(resolve, 100));

        // Combine schedule with box scores
        const gamesWithBoxScores = scheduleData.map((game) => {
          const hasBoxScore = !!boxScoresData[game.game_id];
          const scores = boxScoresData[game.game_id] || [];
          
          // Create Team objects
          const homeTeam = {
            teamId: game.home_team_id.toString(),
            teamName: getTeamName(game.home_team_id.toString()),
            teamAbbreviation: game.home_team_abbreviation,
            score: game.home_team_score,
            players: [],
            periodScores: scores.filter(s => s.teamId === game.home_team_id.toString())
          };
          
          const awayTeam = {
            teamId: game.away_team_id.toString(),
            teamName: getTeamName(game.away_team_id.toString()),
            teamAbbreviation: game.away_team_abbreviation,
            score: game.away_team_score,
            players: [],
            periodScores: scores.filter(s => s.teamId === game.away_team_id.toString())
          };
          
          return {
            ...game,
            boxScoreLoaded: hasBoxScore,
            homeTeam,
            awayTeam,
            periodScores: scores,
            created_at: new Date() // Add required created_at field
          };
        });
        
        // Group games by date
        const games = groupByDate(gamesWithBoxScores);
        setGamesByDate(games);
        setError('');
        setLoadingMessages(prev => [
          ...prev,
          { message: 'Processing and organizing data...', completed: true },
          { message: 'Ready! ✨', completed: true }
        ]);

      } catch (err) {
        console.error('Error in fetchGames:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch games');
      } finally {
        setLoading(false);
        // Dynamic table loading is now handled by the DynamicTableLoader component
      }
    };

    loadAllData();
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  if (loading) {
    return (
      <div className="p-8 space-y-2 font-mono text-sm">
        {loadingMessages.map((msg, index) => (
          <div key={index}>
            {msg.message} {msg.completed ? '✅' : ''}
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="p-8 text-red-500">Error: {error}</div>;
  }

  return (
    <ScheduleProvider>
      {/* Include the DynamicTableLoader component which will load the dynamic table in the background */}
      <DynamicTableLoader />
      <div className="container mx-auto px-4 py-8 font-mono">
        {/* Sticky filter controls */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 pt-4 pb-4 border-b z-10">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <FunnelIcon className="h-5 w-5 text-gray-600" />
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="select select-bordered w-32"
              >
                <option value="">All Teams</option>
                {['ATL','BOS','BKN','CHA','CHI','CLE','DAL','DEN','DET','GSW','HOU','IND','LAC','LAL','MEM','MIA','MIL','MIN','NOP','NYK','OKC','ORL','PHI','PHX','POR','SAC','SAS','TOR','UTA','WAS'].map((abbr) => (
                  <option key={abbr} value={abbr}>{abbr}</option>
                ))}
              </select>
            </div>

            {selectedTeam && (
              <div className="flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                <span>Showing games for:</span>
                <span className="font-medium">{selectedTeam}</span>
                <button 
                  onClick={() => setSelectedTeam('')}
                  className="ml-1 text-blue-500 hover:text-blue-700"
                  aria-label="Clear filter"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        </div>

        {filteredGamesByDate
          .sort((a, b) => b.date.localeCompare(a.date))
          .map(({ date, games }) => {
            if (games.length === 0) return null;
            
            return (
              <div key={date} className="mb-8">
                <h2 className="text-xl font-bold mb-4">
                  {format(parseISO(date), 'EEEE, MMMM do')}
                </h2>
                <div className="grid grid-cols-1 max-md:landscape:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
                  {games.map((game) => (
                    <div key={game.game_id}>
                      {/* Wrap GameCard in a div to handle loading state */}
                      {loadingGames.has(game.game_id) && (
                        <div className="absolute inset-0 bg-white dark:bg-gray-800 bg-opacity-75 dark:bg-opacity-75 flex items-center justify-center rounded-lg">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
                        </div>
                      )}
                      <GameCard
                        game={game}
                        loading={loadingGames.has(game.game_id)}
                        onGameSelect={setSelectedGameId}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        <BoxScorePanel 
          gameId={selectedGameId} 
          onClose={() => setSelectedGameId(null)} 
        />
      </div>
    </ScheduleProvider>
  );
}
