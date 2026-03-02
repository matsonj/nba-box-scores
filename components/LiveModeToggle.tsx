'use client';

import { useState, useEffect } from 'react';
import { useLivePolling } from '@/hooks/useLivePolling';

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

export function LiveModeToggle() {
  const { isLive, setIsLive, lastUpdated, activeGameCount } = useLivePolling(5000);
  const [mounted, setMounted] = useState(false);
  const [timeAgoText, setTimeAgoText] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Update the "time ago" text every second when live
  useEffect(() => {
    if (!isLive || !lastUpdated) return;

    setTimeAgoText(formatTimeAgo(lastUpdated));
    const timer = setInterval(() => {
      setTimeAgoText(formatTimeAgo(lastUpdated));
    }, 1000);

    return () => clearInterval(timer);
  }, [isLive, lastUpdated]);

  if (!mounted) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 mr-3">
      <button
        onClick={() => setIsLive(!isLive)}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
          ${isLive
            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50'
            : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700'
          }
        `}
        aria-label={isLive ? 'Disable live mode' : 'Enable live mode'}
      >
        <span
          className={`
            inline-block w-2 h-2 rounded-full
            ${isLive
              ? 'bg-green-500 animate-pulse'
              : 'bg-gray-400 dark:bg-gray-500'
            }
          `}
        />
        Live
        {isLive && activeGameCount > 0 && (
          <span className="text-xs opacity-75">
            ({activeGameCount})
          </span>
        )}
      </button>
      {isLive && lastUpdated && timeAgoText && (
        <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
          {timeAgoText}
        </span>
      )}
    </div>
  );
}
