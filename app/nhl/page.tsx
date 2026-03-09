'use client';

import { useMemo, useCallback, Suspense } from 'react';
import NHLBoxScorePanel from '@/components/NHLBoxScorePanel';
import SeasonFilter from '@/components/SeasonFilter';
import LiveGamesSection from '@/components/LiveGamesSection';
import GameDateGrid from '@/components/GameDateGrid';
import { getNHLTeamName, NHL_TEAM_ABBREVIATIONS } from '@/lib/nhl/teams';
import { nhlConfig } from '@/lib/sports/nhl';
import { useNHLSchedule, useNHLBoxScores, useNHLPlayerIndex } from '@/hooks/useNHLGameData';
import { useSportPage } from '@/hooks/useSportPage';
import type { NHLLiveBoxScoreResponse } from '@/app/types/live';

const nhlSeasons = nhlConfig.getAvailableSeasons();

function buildGamesWithBoxScores(
  scheduleData: any[],
  boxScoresData: Record<string, Array<{ teamId: string; period: string; points: number }>>,
) {
  return scheduleData.map((game) => {
    const hasBoxScore = !!boxScoresData[game.game_id];
    const scores = boxScoresData[game.game_id] || [];

    const homeTeam = {
      teamId: game.home_team_id.toString(),
      teamName: getNHLTeamName(game.home_team_abbreviation),
      teamAbbreviation: game.home_team_abbreviation,
      score: game.home_team_score,
      players: [],
      periodScores: scores.filter(s => s.teamId === game.home_team_id.toString()),
    };

    const awayTeam = {
      teamId: game.away_team_id.toString(),
      teamName: getNHLTeamName(game.away_team_abbreviation),
      teamAbbreviation: game.away_team_abbreviation,
      score: game.away_team_score,
      players: [],
      periodScores: scores.filter(s => s.teamId === game.away_team_id.toString()),
    };

    return {
      ...game,
      boxScoreLoaded: hasBoxScore,
      isPlayoff: nhlConfig.isPlayoffGame(game.game_id),
      homeTeam,
      awayTeam,
      periodScores: scores,
      created_at: new Date(),
    };
  });
}

function NHLContent() {
  const { fetchSchedule } = useNHLSchedule();
  const { fetchBoxScores } = useNHLBoxScores();
  const { fetchPlayerIndex } = useNHLPlayerIndex();

  const buildGames = useCallback(
    (schedule: any[], boxScores: Record<string, any[]>) =>
      buildGamesWithBoxScores(schedule, boxScores),
    []
  );

  const getDefaultSeason = useCallback(() => nhlConfig.getSeasonYear(new Date()), []);

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
    liveGames,
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
    loadingLabel: 'Fetching NHL game data...',
  });

  // Get the live game's status from the scoreboard
  const selectedLiveGame = useMemo(() => {
    if (!selectedLiveGameId) return null;
    return liveGames.find(g => g.game_id === selectedLiveGameId) ?? null;
  }, [selectedLiveGameId, liveGames]);

  // Transform NHL live box score data for NHLBoxScorePanel
  const nhlLiveBoxScoreData = useMemo(() => {
    if (!selectedLiveGameId || !liveBoxScore) return null;

    const raw = liveBoxScore as NHLLiveBoxScoreResponse;

    const mapSkaters = (team: typeof raw.homeTeam) => {
      return team.skaters.map((s) => ({
        entity_id: s.personId,
        player_name: s.playerName,
        team_abbreviation: team.teamAbbrev,
        position: s.position as string,
        toi: s.toi || '0:00',
        goals: s.goals,
        assists: s.assists,
        points: s.points,
        plus_minus: s.plusMinus,
        pim: s.pim,
        sog: s.shots,
        hits: s.hits,
        blocked_shots: s.blockedShots,
        giveaways: 0,
        takeaways: 0,
        faceoff_wins: s.faceoffWins,
        faceoff_losses: s.faceoffLosses,
      }));
    };

    const mapGoalies = (team: typeof raw.homeTeam) => {
      return team.goalies.map((g) => ({
        entity_id: g.personId,
        player_name: g.playerName,
        team_abbreviation: team.teamAbbrev,
        toi: g.toi || '0:00',
        shots_against: g.shotsAgainst,
        goals_against: g.goalsAgainst,
        saves: g.saves,
        save_pct: g.savePctg,
        starter: g.starter ? 1 : 0,
        decision: g.decision || '',
      }));
    };

    const { homeTeam, awayTeam } = raw;

    const parseToi = (toi: string): number => {
      const [m, s] = toi.split(':').map(Number);
      return (m || 0) * 60 + (s || 0);
    };

    const sortedSkaters = [...mapSkaters(awayTeam), ...mapSkaters(homeTeam)]
      .sort((a, b) => {
        if (a.team_abbreviation !== b.team_abbreviation) {
          return a.team_abbreviation.localeCompare(b.team_abbreviation);
        }
        return parseToi(b.toi) - parseToi(a.toi);
      });

    const sortedGoalies = [...mapGoalies(awayTeam), ...mapGoalies(homeTeam)]
      .filter((g) => parseToi(g.toi) > 0)
      .sort((a, b) => {
        if (a.team_abbreviation !== b.team_abbreviation) {
          return a.team_abbreviation.localeCompare(b.team_abbreviation);
        }
        return b.starter - a.starter;
      });

    return {
      skaters: sortedSkaters,
      goalies: sortedGoalies,
      schedule: {
        game_id: raw.gameId || selectedLiveGameId,
        game_date: new Date().toISOString(),
        home_team_abbreviation: homeTeam.teamAbbrev,
        away_team_abbreviation: awayTeam.teamAbbrev,
        home_team_score: homeTeam.score,
        away_team_score: awayTeam.score,
      },
      gameStatus: selectedLiveGame?.status || raw.gameStatus || '',
      lastPlay: selectedLiveGame?.lastPlay || raw.lastPlay || undefined,
    };
  }, [selectedLiveGameId, liveBoxScore, selectedLiveGame]);

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
    <div className="container mx-auto px-4 py-8 font-mono">
      <SeasonFilter
        basePath="/nhl"
        playerSuggestions={playerSuggestions}
        teamAbbreviations={NHL_TEAM_ABBREVIATIONS}
        seasons={nhlSeasons}
        formatSeason={nhlConfig.formatSeasonLabel}
        defaultSeason={nhlConfig.getSeasonYear(new Date())}
      />
      <NHLBoxScorePanel
        gameId={selectedGameId}
        onClose={handlePanelClose}
        liveData={nhlLiveBoxScoreData}
        highlightedCells={selectedLiveGameId ? highlightedCells : undefined}
        boldedCells={selectedLiveGameId ? boldedCells : undefined}
      />

      {isLive && (
        <LiveGamesSection
          games={activeLiveGames}
          onGameSelect={handleLiveGameSelect}
          regularPeriods={nhlConfig.regularPeriods}
          maxPeriods={nhlConfig.maxPeriods}
        />
      )}

      <GameDateGrid
        loading={loading}
        paginatedDates={paginatedDates}
        totalPages={totalPages}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        onGameSelect={setSelectedGameId}
        regularPeriods={nhlConfig.regularPeriods}
        maxPeriods={nhlConfig.maxPeriods}
      />
    </div>
  );
}

export default function NhlPage() {
  return (
    <Suspense fallback={
      <div className="p-8 space-y-2 font-mono text-sm">
        <div>Loading...</div>
      </div>
    }>
      <NHLContent />
    </Suspense>
  );
}
