'use client';

import { useEffect, useState, useRef } from 'react';
import { useMotherDuckClientState } from '@/lib/MotherDuckContext';
import { useDataLoader } from '@/lib/dataLoader';
import { TEMP_TABLES } from '@/constants/tables';
import type { MaterializedQueryResult } from '@motherduck/wasm-client';

interface DynamicStatsTableProps {
  parameters?: { [key: string]: any };
  dataLoader?: ReturnType<typeof useDataLoader>;
}

interface TableData {
  columns: string[];
  rows: readonly any[];
}

export default function DynamicStatsTable({ parameters, dataLoader: externalDataLoader }: DynamicStatsTableProps) {
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { evaluateQuery } = useMotherDuckClientState();
  
  // Use the provided dataLoader or create a new one if not provided
  const internalDataLoader = useDataLoader();
  const dataLoader = externalDataLoader || internalDataLoader;

  // Use a ref to track if we've already loaded data
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    // Skip loading if we've already loaded and parameters haven't changed
    if (hasLoadedRef.current && !parameters) {
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // First make sure the data is loaded
        await dataLoader.loadData();
        
        // If parameters change, update the dynamic table
        if (parameters) {
          await dataLoader.createDynamicTable(parameters);
        }
        
        // Query the dynamic table
        const result = await evaluateQuery(`SELECT * FROM ${TEMP_TABLES.DYNAMIC_STATS} LIMIT 100`);
        
        // Convert MaterializedQueryResult to array of objects
        const rows = result.data.toRows();
        
        if (rows && rows.length > 0) {
          // Extract column names from the first row
          const columns = Object.keys(rows[0]);
          setTableData({
            columns,
            rows
          });
        } else {
          setTableData({
            columns: [],
            rows: []
          });
        }

        // Mark that we've loaded data
        hasLoadedRef.current = true;
      } catch (err) {
        console.error('Error loading dynamic table data:', err);
        setError('Failed to load data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
    // Only re-run if parameters change or if dataLoader changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parameters, dataLoader]);

  if (isLoading) {
    return <div className="p-4">Loading data...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  if (!tableData || tableData.rows.length === 0) {
    return <div className="p-4">No data available</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {tableData.columns.map((column, index) => (
              <th
                key={index}
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {tableData.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {tableData.columns.map((column, colIndex) => (
                <td key={colIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {row[column]?.toString() || ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
