'use client';

import { useMemo, useCallback, Suspense } from 'react';
import BoxScorePanel from '@/components/BoxScorePanel';
import SeasonFilter from '@/components/SeasonFilter';
import LiveGamesSection from '@/components/LiveGamesSection';
import GameDateGrid from '@/components/GameDateGrid';
import { getTeamName } from '@/lib/teams';
import { useSchedule, useBoxScores, usePlayerIndex } from '@/hooks/useGameData';
import { isPlayoffGame, getSeasonYearFromDate } from '@/lib/seasonUtils';
import { useSportPage } from '@/hooks/useSportPage';
import type { LiveBoxScoreResponse } from '@/app/types/live';
import type { Team } from '@/app/types/schema';
import dynamic from 'next/dynamic';

const DynamicTableLoader = dynamic(
  () => import('@/components/DynamicTableLoader'),
  { ssr: false }
);

function buildGamesWithBoxScores(
  scheduleData: any[],
  boxScoresData: Record<string, Array<{ teamId: string; period: string; points: number }>>,
) {
  return scheduleData.map((game) => {
    const hasBoxScore = !!boxScoresData[game.game_id];
    const scores = boxScoresData[game.game_id] || [];

    const homeTeam = {
      teamId: game.home_team_id.toString(),
      teamName: getTeamName(game.home_team_id.toString()),
      teamAbbreviation: game.home_team_abbreviation,
      score: game.home_team_score,
      players: [],
      periodScores: scores.filter(s => s.teamId === game.home_team_id.toString()),
    };

    const awayTeam = {
      teamId: game.away_team_id.toString(),
      teamName: getTeamName(game.away_team_id.toString()),
      teamAbbreviation: game.away_team_abbreviation,
      score: game.away_team_score,
      players: [],
      periodScores: scores.filter(s => s.teamId === game.away_team_id.toString()),
    };

    return {
      ...game,
      boxScoreLoaded: hasBoxScore,
      isPlayoff: isPlayoffGame(game.game_id),
      homeTeam,
      awayTeam,
      periodScores: scores,
      created_at: new Date(),
    };
  });
}

function HomeContent() {
  const { fetchSchedule } = useSchedule();
  const { fetchBoxScores } = useBoxScores();
  const { fetchPlayerIndex } = usePlayerIndex();

  const buildGames = useCallback(
    (schedule: any[], boxScores: Record<string, any[]>) =>
      buildGamesWithBoxScores(schedule, boxScores),
    []
  );

  const getDefaultSeason = useCallback(() => getSeasonYearFromDate(new Date()), []);

  const {
    loading,
    error,
    loadingMessages,
    selectedGameId,
    selectedLiveGameId,
    currentPage,
    setCurrentPage,
    setSelectedGameId,
    isLive,
    liveBoxScore,
    activeLiveGames,
    handleLiveGameSelect,
    handlePanelClose,
    highlightedCells,
    boldedCells,
    playerSuggestions,
    paginatedDates,
    totalPages,
    initialLoadComplete,
  } = useSportPage({
    fetchSchedule,
    fetchBoxScores,
    fetchPlayerIndex,
    buildGames,
    getDefaultSeason,
    loadingLabel: 'Fetching game data...',
  });

  // Build live box score data for BoxScorePanel
  const liveBoxScoreData = useMemo(() => {
    if (!selectedLiveGameId || !liveBoxScore) return null;

    const nbaBoxScore = liveBoxScore as LiveBoxScoreResponse;

    const mapPlayers = (players: typeof nbaBoxScore.homeTeam.players) =>
      players.map((p) => ({
        playerId: p.personId,
        playerName: p.playerName,
        minutes: p.minutes,
        points: p.points,
        rebounds: p.rebounds,
        assists: p.assists,
        steals: p.steals,
        blocks: p.blocks,
        turnovers: p.turnovers,
        fieldGoalsMade: p.fieldGoalsMade,
        fieldGoalsAttempted: p.fieldGoalsAttempted,
        threePointersMade: p.threePointersMade,
        threePointersAttempted: p.threePointersAttempted,
        freeThrowsMade: p.freeThrowsMade,
        freeThrowsAttempted: p.freeThrowsAttempted,
        plusMinus: p.plusMinus,
        starter: p.starter,
        oncourt: p.oncourt,
        played: p.played,
      }));

    const homeTeam: Team = {
      teamId: nbaBoxScore.homeTeam.teamId,
      teamName: getTeamName(nbaBoxScore.homeTeam.teamTricode),
      teamAbbreviation: nbaBoxScore.homeTeam.teamTricode,
      score: nbaBoxScore.homeTeam.score,
      players: mapPlayers(nbaBoxScore.homeTeam.players),
    };

    const awayTeam: Team = {
      teamId: nbaBoxScore.awayTeam.teamId,
      teamName: getTeamName(nbaBoxScore.awayTeam.teamTricode),
      teamAbbreviation: nbaBoxScore.awayTeam.teamTricode,
      score: nbaBoxScore.awayTeam.score,
      players: mapPlayers(nbaBoxScore.awayTeam.players),
    };

    return {
      homeTeam,
      awayTeam,
      gameStatus: nbaBoxScore.gameStatus,
      lastPlay: nbaBoxScore.lastPlay,
    };
  }, [selectedLiveGameId, liveBoxScore]);

  if (loading && !initialLoadComplete.current) {
    return (
      <div className="p-8 space-y-2 font-mono text-sm">
        {loadingMessages.map((msg, index) => (
          <div key={index}>
            {msg.message} {msg.completed ? '' : ''}
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="p-8 text-red-500">Error: {error}</div>;
  }

  return (
    <>
      <DynamicTableLoader />
      <div className="container mx-auto px-4 py-8 font-mono">
        <SeasonFilter playerSuggestions={playerSuggestions} />

        {isLive && (
          <LiveGamesSection
            games={activeLiveGames}
            onGameSelect={handleLiveGameSelect}
          />
        )}

        <GameDateGrid
          loading={loading}
          paginatedDates={paginatedDates}
          totalPages={totalPages}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          onGameSelect={setSelectedGameId}
        />

        <BoxScorePanel
          gameId={selectedGameId}
          onClose={handlePanelClose}
          liveData={liveBoxScoreData}
          highlightedCells={selectedLiveGameId ? highlightedCells : undefined}
          boldedCells={selectedLiveGameId ? boldedCells : undefined}
        />
      </div>
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="p-8 space-y-2 font-mono text-sm">
        <div>Loading...</div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
