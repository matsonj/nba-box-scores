'use client';

import { useState, useEffect, useRef } from 'react';
import { useLiveData } from '@/lib/LiveDataContext';
import { CountdownRing } from './LiveRefreshButton';

type LiveButtonState = 'off' | 'checking' | 'live' | 'no-games';

const MIN_CHECK_DURATION_MS = 1000;

export function LiveModeToggle() {
  const { isLive, setIsLive, lastUpdated, activeGameCount, pollInterval, pollTick } = useLiveData();
  const [mounted, setMounted] = useState(false);
  const [buttonState, setButtonState] = useState<LiveButtonState>('off');
  const checkStartedAt = useRef<number | null>(null);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!isLive && buttonState !== 'no-games' && buttonState !== 'checking') {
      setButtonState('off');
    }
  }, [isLive, buttonState]);

  useEffect(() => {
    if (buttonState !== 'checking' || !isLive || !lastUpdated) return;

    const elapsed = Date.now() - (checkStartedAt.current ?? Date.now());
    const remaining = Math.max(0, MIN_CHECK_DURATION_MS - elapsed);

    if (transitionTimer.current) clearTimeout(transitionTimer.current);

    transitionTimer.current = setTimeout(() => {
      if (activeGameCount > 0) {
        setButtonState('live');
      } else {
        setButtonState('no-games');
        setIsLive(false);
      }
    }, remaining);

    return () => {
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
    };
  }, [isLive, lastUpdated, activeGameCount, buttonState, setIsLive]);

  useEffect(() => {
    if (buttonState === 'live' && isLive && lastUpdated && activeGameCount === 0) {
      setButtonState('no-games');
      setIsLive(false);
    }
  }, [isLive, lastUpdated, activeGameCount, buttonState, setIsLive]);

  const handleClick = () => {
    if (buttonState === 'off' || buttonState === 'no-games') {
      checkStartedAt.current = Date.now();
      setButtonState('checking');
      setIsLive(true);
    } else {
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
      setButtonState('off');
      setIsLive(false);
    }
  };

  if (!mounted) {
    return null;
  }

  const isDisabled = buttonState === 'no-games';

  const outerBorderColor = (() => {
    switch (buttonState) {
      case 'checking':
        return 'border-yellow-300 dark:border-yellow-700';
      case 'live':
        return 'border-green-300 dark:border-green-700';
      case 'no-games':
        return 'border-gray-300 dark:border-gray-600';
      default:
        return 'border-gray-300 dark:border-gray-600';
    }
  })();

  const innerBgColor = (() => {
    switch (buttonState) {
      case 'checking':
        return 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300';
      case 'live':
        return 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300';
      case 'no-games':
        return 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 opacity-60';
      default:
        return 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400';
    }
  })();

  const dotClasses = (() => {
    switch (buttonState) {
      case 'checking':
        return 'bg-yellow-500 animate-pulse';
      case 'live':
        return 'bg-green-500';
      default:
        return 'bg-gray-400 dark:bg-gray-500';
    }
  })();

  return (
    <>
      <style jsx global>{`
        @keyframes countdown-ring {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: ${2 * Math.PI * 7}; }
        }
      `}</style>
      <div className="mr-2 md:mr-3 self-start relative h-10 overflow-visible flex items-start">
        <button
          onClick={handleClick}
          disabled={isDisabled}
          className={`
            relative overflow-hidden rounded-lg border transition-all duration-300
            ${outerBorderColor}
            h-10
            w-10 md:w-[72px] px-0
          `}
          aria-label={
            buttonState === 'live' ? 'Disable live mode' :
            buttonState === 'checking' ? 'Checking for live games...' :
            buttonState === 'no-games' ? 'No games available' :
            'Enable live mode'
          }
        >
          <div className={`
            flex items-center justify-center md:justify-start gap-2 md:px-3 text-sm font-medium whitespace-nowrap
            transition-all duration-300 rounded-[5px]
            ${innerBgColor}
            h-full
          `}>
            <span className="relative inline-flex items-center justify-center w-4 h-4 flex-shrink-0">
              <span className={`inline-block w-2 h-2 rounded-full transition-colors duration-300 ${dotClasses}`} />
              {buttonState === 'live' && (
                <CountdownRing key={pollTick} durationMs={pollInterval} size={16} />
              )}
            </span>
            <span className="hidden md:inline">Live</span>
            {buttonState === 'live' && activeGameCount > 0 && (
              <span className="hidden md:inline text-xs opacity-75">
                ({activeGameCount})
              </span>
            )}
          </div>
        </button>
      </div>
    </>
  );
}
