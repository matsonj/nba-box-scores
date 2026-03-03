'use client';

import { useState, useEffect, useRef } from 'react';
import { useLiveData } from '@/lib/LiveDataContext';

type LiveButtonState = 'off' | 'checking' | 'live' | 'no-games';

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

const MIN_CHECK_DURATION_MS = 1000;

export function LiveModeToggle() {
  const { isLive, setIsLive, lastUpdated, activeGameCount } = useLiveData();
  const [mounted, setMounted] = useState(false);
  const [timeAgoText, setTimeAgoText] = useState('');
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

  useEffect(() => {
    if (buttonState !== 'live' || !lastUpdated) return;

    setTimeAgoText(formatTimeAgo(lastUpdated));
    const timer = setInterval(() => {
      setTimeAgoText(formatTimeAgo(lastUpdated));
    }, 1000);

    return () => clearInterval(timer);
  }, [buttonState, lastUpdated]);

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

  const isActive = buttonState !== 'off';
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
        return 'bg-green-500 animate-[pulse_3s_ease-in-out_infinite]';
      default:
        return 'bg-gray-400 dark:bg-gray-500';
    }
  })();

  const statusText = (() => {
    switch (buttonState) {
      case 'checking':
        return 'checking...';
      case 'no-games':
        return 'no games';
      case 'live':
        return lastUpdated && timeAgoText ? timeAgoText : null;
      default:
        return null;
    }
  })();

  const statusColor = buttonState === 'checking'
    ? 'text-yellow-600 dark:text-yellow-400'
    : 'text-gray-500 dark:text-gray-400';

  return (
    <div className="mr-3 self-center relative h-10 overflow-visible">
      <button
        onClick={handleClick}
        disabled={isDisabled}
        className={`
          relative overflow-hidden rounded-lg border transition-all duration-300
          ${outerBorderColor}
          ${isActive ? 'h-[42px]' : 'h-10'}
          w-[72px] px-0
        `}
        aria-label={
          buttonState === 'live' ? 'Disable live mode' :
          buttonState === 'checking' ? 'Checking for live games...' :
          buttonState === 'no-games' ? 'No games available' :
          'Enable live mode'
        }
      >
        {/* Inner slider that slides up when active */}
        <div className={`
          flex items-center gap-2 px-3 text-sm font-medium whitespace-nowrap
          transition-all duration-300 rounded-[5px]
          ${innerBgColor}
          ${isActive ? 'h-[24px] mt-0' : 'h-full'}
        `}>
          <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 transition-colors duration-300 ${dotClasses}`} />
          Live
          {buttonState === 'live' && activeGameCount > 0 && (
            <span className="text-xs opacity-75">
              ({activeGameCount})
            </span>
          )}
        </div>
        {/* Status text area below the slider */}
        <div className={`
          text-[10px] leading-none px-2 flex items-center justify-center
          transition-opacity duration-300
          ${isActive ? 'opacity-100 h-[16px]' : 'opacity-0 h-0'}
          ${statusColor}
        `}>
          {statusText || '\u00A0'}
        </div>
      </button>
    </div>
  );
}
