'use client';

import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';
import BoxScoreTable from './BoxScoreTable';
import { BoxScore } from '@/types/schema';

interface PlayerStats {
  gameId: string;
  teamId: number;
  entityId: string;
  playerName: string;
  minutes: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  threePointersMade: number;
  threePointersAttempted: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  plusMinus: number;
  starter: boolean;
  period: string;
}

interface TeamStats {
  game_id: string;
  team_id: number;
  period: string;
  minutes: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fgMade: number;
  fgAttempted: number;
  fg3Made: number;
  fg3Attempted: number;
  ftMade: number;
  ftAttempted: number;
  offensive_possessions: number;
  defensive_possessions: number;
}

interface Team extends TeamStats {
  teamId: number;
  teamName: string;
  teamAbbreviation: string;
  score: number;
  players: PlayerStats[];
}

interface Game {
  game_id: string;
  game_date: string;
  home_team_id: number;
  away_team_id: number;
  home_team_score: number;
  away_team_score: number;
  status: string;
  home_team_abbreviation: string;
  away_team_abbreviation: string;
}

interface BoxScore {
  gameInfo: Game;
  teams: Team[];
}

export default function GamePage({ params }: { params: { gameId: string } }) {
  const [boxScore, setBoxScore] = useState<BoxScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchBoxScore = async () => {
      try {
        const response = await fetch(`/api/box-scores/${params.gameId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch box score');
        }
        const data = await response.json();
        setBoxScore(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch box score');
      } finally {
        setLoading(false);
      }
    };

    fetchBoxScore();
  }, [params.gameId]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!boxScore) return <div>No data available</div>;

  const { gameInfo, teams } = boxScore;

  console.log('Game info:', gameInfo);
  console.log('Teams:', teams);

  // Find home and away teams
  const homeTeam = teams.find(team => team.teamId === gameInfo.home_team_id);
  const awayTeam = teams.find(team => team.teamId === gameInfo.away_team_id);

  console.log('Found home team:', homeTeam);
  console.log('Found away team:', awayTeam);
  console.log('Looking for home team ID:', gameInfo.home_team_id);
  console.log('Looking for away team ID:', gameInfo.away_team_id);

  if (!homeTeam || !awayTeam) {
    throw new Error('Failed to find team data');
  }

  return (
    <div className="container mx-auto px-4 py-8 font-mono print:p-2 print:max-w-none">
      <div className="relative">
        <Link href="/" className="absolute left-0 top-0 text-2xl text-gray-600 hover:text-black print:hidden">←</Link>
        <div className="text-center mb-8 print:mb-4">
          <div className="text-2xl font-bold mb-2 print:text-xl">
            <span className={gameInfo.away_team_score > gameInfo.home_team_score ? "" : "text-gray-500 print:text-black"}>
              {gameInfo.away_team_score > gameInfo.home_team_score ? "* " : ""}
              {gameInfo.away_team_abbreviation} {gameInfo.away_team_score}
            </span>
            <span className="text-gray-500 print:text-black"> @ </span>
            <span className={gameInfo.home_team_score > gameInfo.away_team_score ? "" : "text-gray-500 print:text-black"}>
              {gameInfo.home_team_score} {gameInfo.home_team_abbreviation}
              {gameInfo.home_team_score > gameInfo.away_team_score ? " *" : ""}
            </span>
          </div>
          <p className="text-lg text-gray-600 print:text-sm print:text-black">
            {format(parseISO(gameInfo.game_date), 'MMMM d, yyyy • h:mm a')}
          </p>
        </div>

        {[awayTeam, homeTeam].map((team) => (
          <BoxScoreTable
            key={team.teamId}
            players={team.players}
            teamName={team.teamName}
          />
        ))}
      </div>
    </div>
  );
}
