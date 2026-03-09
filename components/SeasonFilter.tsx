'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useCallback, useState, useRef, useEffect } from 'react';
import { TEAM_ABBREVIATIONS } from '@/lib/teams';
import { getAvailableSeasons, formatSeasonLabel, getSeasonYearFromDate } from '@/lib/seasonUtils';
import type { SeasonType } from '@/lib/seasonUtils';

const SEASON_TYPES: { value: SeasonType; label: string }[] = [
  { value: 'all', label: 'All Games' },
  { value: 'regular', label: 'Regular Season' },
  { value: 'playoffs', label: 'Playoffs' },
];

const availableSeasons = getAvailableSeasons();

interface PlayerSuggestion {
  entity_id: string;
  player_name: string;
  team_abbreviation: string;
}

interface SeasonFilterProps {
  basePath?: string;
  onFilterChange?: (filters: { season?: number; type?: SeasonType; team?: string }) => void;
  playerSuggestions?: PlayerSuggestion[];
  teamAbbreviations?: readonly string[];
  seasons?: number[];
  formatSeason?: (year: number) => string;
  defaultSeason?: number;
}

export default function SeasonFilter({
  basePath = '/',
  onFilterChange,
  playerSuggestions = [],
  teamAbbreviations = TEAM_ABBREVIATIONS,
  seasons = availableSeasons,
  formatSeason = formatSeasonLabel,
  defaultSeason,
}: SeasonFilterProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentSeason = defaultSeason ?? getSeasonYearFromDate(new Date());
  const season = searchParams?.get('season') ? Number(searchParams.get('season')) : currentSeason;
  const seasonType = (searchParams?.get('type') as SeasonType) || 'all';
  const team = searchParams?.get('team') || '';
  const player = searchParams?.get('player') || '';

  // Close suggestions on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset highlight when suggestions change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [playerSuggestions]);

  const updateParams = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (value && value !== 'all' && value !== '') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    const queryString = params.toString();
    router.replace(queryString ? `${basePath}?${queryString}` : basePath, { scroll: false });

    // Notify parent of filter change
    const newParams = new URLSearchParams(queryString);
    onFilterChange?.({
      season: newParams.get('season') ? Number(newParams.get('season')) : undefined,
      type: (newParams.get('type') as SeasonType) || undefined,
      team: newParams.get('team') || undefined,
    });
  }, [searchParams, router, basePath, onFilterChange]);

  const hasActiveFilters = season || seasonType !== 'all' || team || player;

  const clearAll = useCallback(() => {
    router.replace(basePath, { scroll: false });
    onFilterChange?.({});
  }, [router, basePath, onFilterChange]);

  return (
    <div className="sticky top-16 bg-white dark:bg-gray-900 pt-4 pb-4 border-b border-gray-200 dark:border-gray-700 z-10">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5 text-gray-600 dark:text-gray-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
          </svg>
          <select
            value={season ?? ''}
            onChange={(e) => updateParams('season', e.target.value)}
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm w-32"
          >
            <option value="">All Seasons</option>
            {seasons.map((year) => (
              <option key={year} value={year}>{formatSeason(year)}</option>
            ))}
          </select>
          <select
            value={seasonType}
            onChange={(e) => updateParams('type', e.target.value)}
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm w-40"
          >
            {SEASON_TYPES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select
            value={team}
            onChange={(e) => updateParams('team', e.target.value)}
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm w-32"
          >
            <option value="">All Teams</option>
            {teamAbbreviations.map((abbr) => (
              <option key={abbr} value={abbr}>{abbr}</option>
            ))}
          </select>
          <div className="relative">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={player}
              onChange={(e) => {
                updateParams('player', e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(e) => {
                if (!showSuggestions || playerSuggestions.length === 0) return;
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setHighlightedIndex(i => Math.min(i + 1, playerSuggestions.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setHighlightedIndex(i => Math.max(i - 1, 0));
                } else if (e.key === 'Enter' && highlightedIndex >= 0) {
                  e.preventDefault();
                  updateParams('player', playerSuggestions[highlightedIndex].player_name);
                  setShowSuggestions(false);
                } else if (e.key === 'Escape') {
                  setShowSuggestions(false);
                }
              }}
              placeholder="Search player..."
              className="pl-7 pr-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm w-40"
              autoComplete="off"
            />
            {showSuggestions && playerSuggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg z-50 max-h-60 overflow-y-auto"
              >
                {playerSuggestions.map((s, i) => (
                  <button
                    key={s.entity_id}
                    className={`w-full text-left px-3 py-1.5 text-sm flex items-center justify-between ${
                      i === highlightedIndex
                        ? 'bg-blue-100 dark:bg-blue-900'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      updateParams('player', s.player_name);
                      setShowSuggestions(false);
                    }}
                    onMouseEnter={() => setHighlightedIndex(i)}
                  >
                    <span className="text-gray-900 dark:text-gray-100">{s.player_name}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">{s.team_abbreviation}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {hasActiveFilters && (
          <button
            onClick={clearAll}
            className="text-sm text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
