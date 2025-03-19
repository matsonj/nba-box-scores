'use client';

import { useRef, useEffect, useState } from 'react';
import DynamicStatsTable from '@/components/DynamicStatsTable';
import { useDataLoader } from '@/lib/dataLoader';

export function DynamicTablePopover() {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  
  // Create a stable dataLoader instance
  const dataLoader = useDataLoader();

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-10 h-10 p-2 rounded-lg bg-blue-100 dark:bg-blue-800 hover:bg-blue-200 dark:hover:bg-blue-700 transition-colors ml-2"
        aria-label="View dynamic table"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-6 h-6 text-blue-600 dark:text-blue-200"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 2.25h-7.5a1.125 1.125 0 01-1.125-1.125m8.625-2.25h.375c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125h-.375m1.125-2.25h-7.5A1.125 1.125 0 015.25 13.5m8.625-2.25h.375c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125h-.375m0-2.25h-7.5A1.125 1.125 0 017 11.25m-3.75 2.25h.008v.008h-.008v-.008zm0-1.5h.008v.008h-.008v-.008zm0-1.5h.008v.008h-.008v-.008z"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="fixed right-4 top-16 w-[600px] max-h-[80vh] overflow-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg z-[100] border border-gray-200 dark:border-gray-700">
          <div className="p-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-semibold">Dynamic Stats</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            {/* Only render the table once when the popover is opened */}
            <DynamicStatsTable key="dynamic-stats-table" dataLoader={dataLoader} />
          </div>
        </div>
      )}
    </div>
  );
}
