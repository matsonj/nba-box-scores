'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDataLoader } from '@/lib/dataLoader';
import { getSeasonYearFromDate } from '@/lib/seasonUtils';

/**
 * This component is responsible for loading the dynamic table in the background.
 * It reads the current season filter from URL params so temp tables only
 * contain the selected season's data.
 */
export default function DynamicTableLoader() {
  const [isLoading, setIsLoading] = useState(false);
  const dataLoader = useDataLoader();
  const searchParams = useSearchParams();

  const currentSeason = getSeasonYearFromDate(new Date());
  const season = searchParams?.get('season') ? Number(searchParams.get('season')) : currentSeason;

  useEffect(() => {
    if (isLoading) return;

    const timer = setTimeout(() => {
      console.log(`DynamicTableLoader: Creating dynamic table for season ${season}...`);
      setIsLoading(true);

      dataLoader.createDynamicTable(season)
        .then(() => {
          console.log('DynamicTableLoader: Dynamic table created successfully');
        })
        .catch(error => {
          console.error('DynamicTableLoader: Error creating dynamic table:', error);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }, 5000);

    return () => clearTimeout(timer);
  }, [dataLoader, isLoading, season]);

  return null;
}
