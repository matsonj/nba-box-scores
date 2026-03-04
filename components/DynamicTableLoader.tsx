'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDataLoader } from '@/lib/dataLoader';
import { getSeasonYearFromDate } from '@/lib/seasonUtils';

/**
 * Creates temp tables scoped to the current season filter on mount,
 * then recreates them whenever the season URL param changes.
 */
export default function DynamicTableLoader() {
  const dataLoader = useDataLoader();
  const searchParams = useSearchParams();
  const loadingRef = useRef(false);

  const currentSeason = getSeasonYearFromDate(new Date());
  const season = searchParams?.get('season') ? Number(searchParams.get('season')) : currentSeason;

  useEffect(() => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    dataLoader.createDynamicTable(season)
      .catch(error => {
        console.error('DynamicTableLoader: Error creating dynamic table:', error);
      })
      .finally(() => {
        loadingRef.current = false;
      });
  }, [season]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
