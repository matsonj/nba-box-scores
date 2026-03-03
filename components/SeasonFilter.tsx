'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { FunnelIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { TEAM_ABBREVIATIONS } from '@/lib/teams';
import { getAvailableSeasons, formatSeasonLabel, getSeasonYearFromDate } from '@/lib/seasonUtils';
import type { SeasonType } from '@/lib/seasonUtils';

const SEASON_TYPES: { value: SeasonType; label: string }[] = [
  { value: 'all', label: 'All Games' },
  { value: 'regular', label: 'Regular Season' },
  { value: 'playoffs', label: 'Playoffs' },
];

const availableSeasons = getAvailableSeasons();

interface SeasonFilterProps {
  basePath?: string;
  onFilterChange?: (filters: { season?: number; type?: SeasonType; team?: string }) => void;
}

export default function SeasonFilter({ basePath = '/', onFilterChange }: SeasonFilterProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const currentSeason = getSeasonYearFromDate(new Date());
  const season = searchParams?.get('season') ? Number(searchParams.get('season')) : currentSeason;
  const seasonType = (searchParams?.get('type') as SeasonType) || 'all';
  const team = searchParams?.get('team') || '';
  const player = searchParams?.get('player') || '';

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
          <FunnelIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          <select
            value={season ?? ''}
            onChange={(e) => updateParams('season', e.target.value)}
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm w-32"
          >
            <option value="">All Seasons</option>
            {availableSeasons.map((year) => (
              <option key={year} value={year}>{formatSeasonLabel(year)}</option>
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
            {TEAM_ABBREVIATIONS.map((abbr) => (
              <option key={abbr} value={abbr}>{abbr}</option>
            ))}
          </select>
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={player}
              onChange={(e) => updateParams('player', e.target.value)}
              placeholder="Search player..."
              className="pl-7 pr-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm w-40"
            />
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
