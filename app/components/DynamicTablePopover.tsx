'use client';

import { useRef, useEffect, useState } from 'react';
import DynamicStatsTable from '@/components/DynamicStatsTable';
import { useDataLoader } from '@/lib/dataLoader';
import { InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';

export function DynamicTablePopover() {
  const [isOpen, setIsOpen] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
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
        className="w-10 h-10 p-2 rounded-lg bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors mr-3"
        aria-label="View game quality stats"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-6 h-6 text-gray-800 dark:text-gray-200"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[90] flex items-center justify-center p-4 md:p-0">
          <div className="w-full md:w-3/4 lg:w-2/3 h-full md:h-auto max-h-[90vh] md:max-h-[80vh] bg-white dark:bg-gray-800 rounded-lg shadow-lg z-[100] border border-gray-200 dark:border-gray-700 overflow-auto relative">
            <div className="sticky top-0 bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700 z-10">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold dark:text-white">Game Quality Stats</h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowInfoModal(true);
                    }}
                    className="focus:outline-none"
                    aria-label="Show information about Game Quality"
                  >
                    <InformationCircleIcon 
                      className="h-5 w-5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 cursor-pointer" 
                    />
                  </button>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  aria-label="Close"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-4 font-mono">
              {/* Only render the table once when the popover is opened */}
              <DynamicStatsTable key="dynamic-stats-table" dataLoader={dataLoader} />
            </div>
          </div>
        </div>
      )}
      
      {/* Info Modal */}
      {showInfoModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[300]"
          onClick={() => setShowInfoModal(false)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowInfoModal(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              aria-label="Close"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
            
            <h3 className="text-lg font-semibold mb-4 dark:text-white">About Game Quality (GQ)</h3>
            
            <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
              <p>Game Quality (GQ) measures a player&apos;s statistical performance relative to other players in the same week.</p>
              <p>It compares 9 statistical categories (FGv, FTv, 3P, PTS, REB, AST, STL, BLK, TO) against every other player who played at least 15 minutes that week.</p>
              <p>A player gets 1 point for each stat where they outperform another player, 0.5 points for ties. The total is divided by the number of games that week to create a normalized score.</p>
              <p>FGv and FTv represent shooting efficiency above league average (47% for FG, 80% for FT).</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
