'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import BoxScore from './BoxScore';
import { Team, Player, Schedule } from '@/app/types/schema';

interface BoxScorePanelProps {
  gameId: string | null;
  onClose: () => void;
}

interface BoxScoreResponse {
  gameInfo: Schedule;
  teams: {
    teamId: number;
    teamName: string;
    teamAbbreviation: string;
    score: number;
    players: Player[];
  }[];
  periodScores: {
    period: string;
    teamId: string;
    points: number;
  }[];
}

export default function BoxScorePanel({ gameId, onClose }: BoxScorePanelProps) {
  const [loading, setLoading] = useState(false);
  const [homeTeam, setHomeTeam] = useState<Team | null>(null);
  const [awayTeam, setAwayTeam] = useState<Team | null>(null);
  const [gameInfo, setGameInfo] = useState<Schedule | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (gameId) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [gameId]);

  useEffect(() => {
    if (!gameId) return;

    const fetchBoxScore = async () => {
      setLoading(true);
      try {
        console.log('Fetching box score for game:', gameId);
        const response = await fetch(`/api/box-scores/${gameId}`);
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch box score: ${errorText}`);
        }
        const data: BoxScoreResponse = await response.json();
        console.log('Box score data received:', data);
        
        // Find home and away teams from the teams array
        const homeTeam = data.teams.find(team => team.teamId === Number(data.gameInfo.home_team_id));
        const awayTeam = data.teams.find(team => team.teamId === Number(data.gameInfo.away_team_id));
        
        if (!homeTeam || !awayTeam) {
          throw new Error('Could not find home or away team in response');
        }

        // Convert to Team type
        const convertedHomeTeam: Team = {
          teamId: homeTeam.teamId.toString(),
          teamName: homeTeam.teamName,
          teamAbbreviation: homeTeam.teamAbbreviation,
          score: homeTeam.score,
          players: homeTeam.players
        };

        const convertedAwayTeam: Team = {
          teamId: awayTeam.teamId.toString(),
          teamName: awayTeam.teamName,
          teamAbbreviation: awayTeam.teamAbbreviation,
          score: awayTeam.score,
          players: awayTeam.players
        };

        setHomeTeam(convertedHomeTeam);
        setAwayTeam(convertedAwayTeam);
        setGameInfo(data.gameInfo);
      } catch (error) {
        console.error('Error fetching box score:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBoxScore();
  }, [gameId]);

  const handleClose = () => {
    setIsVisible(false);
    // Reset all state variables
    setTimeout(() => {
      setHomeTeam(null);
      setAwayTeam(null);
      setGameInfo(null);
      onClose();
    }, 300);
  };

  if (!gameId) return null;

  return (
    <div 
      className={`fixed right-0 top-[88px] h-[calc(100vh-88px)] w-[80vw] bg-white shadow-lg transform transition-transform duration-300 ease-in-out ${
        isVisible ? 'translate-x-0' : 'translate-x-full'
      } z-10`}
    >
      <div className="relative h-full">
        <div className="absolute top-4 right-4 z-50">
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close panel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600 hover:text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6 md:text-base text-[50%]">
          {homeTeam && awayTeam && gameInfo && (
            <div className="mb-6">
              <h2 className="md:text-2xl text-lg text-center">
                {awayTeam.score > homeTeam.score ? (
                  <>
                    <span className="font-bold">* {awayTeam.teamAbbreviation} {awayTeam.score}</span>
                    {' - '}
                    <span>{homeTeam.teamAbbreviation} {homeTeam.score}</span>
                  </>
                ) : (
                  <>
                    <span>{awayTeam.teamAbbreviation} {awayTeam.score}</span>
                    {' - '}
                    <span className="font-bold">{homeTeam.teamAbbreviation} {homeTeam.score} *</span>
                  </>
                )}
              </h2>
              <p className="text-gray-600 text-center mt-2 md:text-base text-sm">
                {format(new Date(gameInfo.game_date), 'MMMM d, yyyy • h:mm a')}
              </p>
            </div>
          )}
          
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : homeTeam && awayTeam ? (
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
              <BoxScore homeTeam={homeTeam} awayTeam={awayTeam} />
            </div>
          ) : (
            <div className="text-center text-gray-500">No box score data available</div>
          )}
        </div>
      </div>
    </div>
  );
}
