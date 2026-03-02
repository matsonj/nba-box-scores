'use client';

import { useState, useEffect, useRef } from 'react';
import { useMotherDuckClientState } from '@/lib/MotherDuckContext';
import { useDataLoader } from '@/lib/dataLoader';
import { TEMP_TABLES } from '@/constants/tables';
import dynamic from 'next/dynamic';

const GameQualityDistribution = dynamic(
  () => import('@/components/charts/GameQualityDistribution'),
  { ssr: false, loading: () => <div className="h-[250px]" /> }
);

export default function ChartsPage() {
  const [gqData, setGqData] = useState<readonly Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { evaluateQuery } = useMotherDuckClientState();
  const dataLoader = useDataLoader();
  const loadAttempted = useRef(false);

  useEffect(() => {
    if (loadAttempted.current) return;
    loadAttempted.current = true;

    const loadData = async () => {
      try {
        await dataLoader.waitForWasm();
        await dataLoader.loadEssentialTables();

        // Try to load dynamic stats; they may still be computing
        try {
          await evaluateQuery(`SELECT 1 FROM ${TEMP_TABLES.DYNAMIC_STATS} LIMIT 1`);
        } catch {
          // Create the dynamic table if it doesn't exist
          await dataLoader.createDynamicTable();
        }

        const result = await evaluateQuery(`
          SELECT game_quality, player_name, points, rebounds, assists, week_id
          FROM ${TEMP_TABLES.DYNAMIC_STATS}
          WHERE game_quality > 0
          ORDER BY game_quality DESC
          LIMIT 200
        `);

        setGqData(result.data.toRows());
      } catch (err) {
        console.error('Error loading chart data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 font-mono">
      <h1 className="text-2xl font-bold mb-6 dark:text-white">Analytics</h1>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading analytics data...</span>
        </div>
      ) : error ? (
        <div className="p-4 text-red-500">Error: {error}</div>
      ) : (
        <div className="space-y-8">
          <section className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-lg font-bold mb-4 dark:text-white">Game Quality Distribution</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Distribution of game quality scores across all players. Higher GQ indicates a player outperforming their peers across all 9 fantasy categories.
            </p>
            {gqData.length > 0 ? (
              <GameQualityDistribution rows={gqData} />
            ) : (
              <p className="text-gray-500">No game quality data available yet.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
