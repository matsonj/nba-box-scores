'use client';

import { useEffect, useState } from 'react';
import { useDataLoader } from '@/lib/dataLoader';

/**
 * This component is responsible for loading the dynamic table in the background
 * It doesn't render anything visible and is only used for its side effects
 */
export default function DynamicTableLoader() {
  const [isLoading, setIsLoading] = useState(false);
  const dataLoader = useDataLoader();

  useEffect(() => {
    // Only attempt to load once
    if (isLoading) return;
    
    // Set a long delay before starting the dynamic table load
    // This ensures the main application is fully loaded and interactive
    const timer = setTimeout(() => {
      console.log('DynamicTableLoader: Starting dynamic table calculation in background...');
      setIsLoading(true);
      
      // Skip loading essential tables since they're already loaded by the main app
      dataLoader.createDynamicTable()
        .then(() => {
          console.log('DynamicTableLoader: Dynamic table created successfully');
        })
        .catch(error => {
          console.error('DynamicTableLoader: Error creating dynamic table:', error);
        });
    }, 5000); // 5 second delay to ensure main app is fully loaded
    
    return () => clearTimeout(timer);
  }, [dataLoader, isLoading]);

  // This component doesn't render anything
  return null;
}
