'use client';

import { useEffect, useState, useRef } from 'react';
import { useMotherDuckClientState } from '@/lib/MotherDuckContext';
import { useDataLoader } from '@/lib/dataLoader';
import { TEMP_TABLES } from '@/constants/tables';

interface DynamicStatsTableProps {
  parameters?: { [key: string]: unknown };
  dataLoader?: ReturnType<typeof useDataLoader>;
}

interface TableData {
  columns: string[];
  rows: readonly Record<string, unknown>[];
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
        
        // Update the dynamic table
        await dataLoader.createDynamicTable();
        
        // Query the dynamic table with specific columns in the requested order
        const result = await evaluateQuery(`
          SELECT 
            game_id, 
            player_name, 
            game_quality, 
            points, 
            rebounds, 
            assists, 
            steals, 
            blocks, 
            turnovers, 
            fg_v, 
            fg3_made, 
            ft_v 
          FROM ${TEMP_TABLES.DYNAMIC_STATS} 
          WHERE game_quality > 0 
          ORDER BY game_quality DESC 
          LIMIT 100
        `);
        
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

  // Define the columns we want to display in the order we want them
  const displayColumns = [
    'game_id',
    'player_name',
    'game_quality',
    'points',
    'rebounds',
    'assists',
    'steals',
    'blocks',
    'turnovers',
    'fg_v',
    'fg3_made',
    'ft_v'
  ];

  // Map column names to display names
  const columnDisplayNames: Record<string, string> = {
    'game_id': 'Game ID',
    'player_name': 'Player',
    'game_quality': 'Game Quality',
    'points': 'PTS',
    'rebounds': 'REB',
    'assists': 'AST',
    'steals': 'STL',
    'blocks': 'BLK',
    'turnovers': 'TO',
    'fg_v': 'FG Value',
    'fg3_made': '3P Made',
    'ft_v': 'FT Value'
  };

  // Filter rows to only include players with game quality > 0
  const filteredRows = tableData.rows.filter(row => {
    const gameQuality = row.game_quality as number;
    return gameQuality > 0;
  });
  
  return (
    <div className="w-full">
      <table className="min-w-full table-auto">
        <thead>
          <tr className="bg-gray-100 dark:bg-gray-700">
            {displayColumns.map((column, index) => (
              <th
                key={index}
                className="md:px-1 md:py-0.5 p-0.5 text-right md:text-base text-xs dark:text-gray-200 bg-transparent"
                style={{ textAlign: column === 'player_name' ? 'left' : 'right' }}
              >
                {columnDisplayNames[column] || column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredRows.map((row, rowIndex) => (
            <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}>
              {displayColumns.map((column, colIndex) => {
                let displayValue = row[column]?.toString() || '';
                
                // Format game_quality as a percentage with 2 decimal places
                if (column === 'game_quality' && displayValue) {
                  const value = parseFloat(displayValue);
                  if (!isNaN(value)) {
                    displayValue = (value * 100).toFixed(1) + '%';
                  }
                }
                
                return (
                  <td 
                    key={colIndex} 
                    className="md:px-1 md:py-0.5 p-0.5 md:text-base text-xs dark:text-gray-200"
                    style={{ textAlign: column === 'player_name' ? 'left' : 'right' }}
                  >
                    {displayValue}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
