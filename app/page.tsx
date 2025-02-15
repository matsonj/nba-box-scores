'use client';

import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { ScheduleWithBoxScore } from './types/extended';
import BoxScorePanel from '@/components/BoxScorePanel';
import { ScheduleProvider } from '@/context/ScheduleContext';
import { getTeamName } from '@/lib/teams';
import { useSchedule, useBoxScores } from '@/hooks/useGameData';
import { debugLog } from '@/lib/debug';
import { FunnelIcon } from '@heroicons/react/24/outline';

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
  const [loadingGames] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string>('');

  const { fetchSchedule } = useSchedule();
  const { fetchBoxScores } = useBoxScores();

  useEffect(() => {
    const fetchGames = async () => {
      try {
        setLoading(true);
        setError('');
        
        // Fetch schedule and box scores in parallel using WASM client
        console.log('Fetching data...');
        const [scheduleData, boxScoresData] = await Promise.all([
          fetchSchedule(),
          fetchBoxScores()
        ]);

        debugLog('data_fetched', {
          scheduleCount: scheduleData.length,
          boxScoresCount: Object.keys(boxScoresData).length,
          scheduleData,
          boxScoresData
        });

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
        
        debugLog('games_with_box_scores', gamesWithBoxScores);
        
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
  }, [fetchSchedule, fetchBoxScores]);

  if (loading) {
    return <div className="p-8">Loading schedule...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-500">Error: {error}</div>;
  }

  const filteredGamesByDate = Object.entries(gamesByDate).map(([date, games]) => ({
    date,
    games: games.filter(game => 
      !selectedTeam || 
      game.homeTeam.teamAbbreviation === selectedTeam ||
      game.awayTeam.teamAbbreviation === selectedTeam
    )
  }));

  return (
    <ScheduleProvider>
      <div className="container mx-auto px-4 py-8 font-mono">
        {/* Sticky filter controls */}
        <div className="sticky top-0 z-50 bg-white dark:bg-gray-900 pt-4 pb-4 border-b">
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
                  {games.map((game) => (
                    <div 
                      key={game.game_id} 
                      className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-4 cursor-pointer hover:shadow-lg transition-shadow relative"
                      onClick={() => setSelectedGameId(game.game_id)}
                    >
                      {loadingGames.has(game.game_id) && (
                        <div className="absolute inset-0 bg-white dark:bg-gray-800 bg-opacity-75 dark:bg-opacity-75 flex items-center justify-center rounded-lg">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
                        </div>
                      )}
                      {/* Period scores */}
                      {game.boxScoreLoaded && game.periodScores && (() => {
                        const periodScores = game.periodScores;
                        const uniquePeriods = Array.from(new Set(periodScores.map(ps => ps.period)));
                        return (
                        <div className="w-full">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-gray-600 dark:text-gray-400">
                                <th className="text-left">Team</th>
                                {uniquePeriods.map(period => (
                                  <th key={period} className="text-center w-8">
                                    {formatPeriod(period, uniquePeriods)}
                                  </th>
                                ))}
                                <th className="text-center w-8">T</th>
                              </tr>
                            </thead>
                            <tbody className="dark:text-gray-200">
                              <tr>
                                <td className="text-left">{game.awayTeam.teamAbbreviation}</td>
                                {uniquePeriods.sort((a, b) => parseInt(a) - parseInt(b)).map(period => (
                                  <td key={period} className="text-center">
                                    {periodScores.find(ps => 
                                      parseInt(ps.period) === parseInt(period) && 
                                      String(ps.teamId) === String(game.awayTeam.teamId)
                                    )?.points || '-'}
                                  </td>
                                ))}
                                <td className="text-center font-semibold">{game.awayTeam.score}</td>
                              </tr>
                              <tr>
                                <td className="text-left">{game.homeTeam.teamAbbreviation}</td>
                                {uniquePeriods.sort((a, b) => parseInt(a) - parseInt(b)).map(period => (
                                  <td key={period} className="text-center">
                                    {periodScores.find(ps => 
                                      parseInt(ps.period) === parseInt(period) && 
                                      String(ps.teamId) === String(game.homeTeam.teamId)
                                    )?.points || '-'}
                                  </td>
                                ))}
                                <td className="text-center font-semibold">{game.homeTeam.score}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        );
                      })()}
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
