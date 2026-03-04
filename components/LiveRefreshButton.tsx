'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLiveData } from '@/lib/LiveDataContext';

const REFRESH_COOLDOWN_MS = 60000;

export function LiveRefreshButton() {
  const { forceRefresh } = useLiveData();
  const [cooldownEnd, setCooldownEnd] = useState<number | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [ringKey, setRingKey] = useState(0);

  useEffect(() => {
    if (!cooldownEnd) {
      setCooldownRemaining(0);
      return;
    }

    const tick = () => {
      const remaining = Math.max(0, cooldownEnd - Date.now());
      setCooldownRemaining(remaining);
      if (remaining <= 0) {
        setCooldownEnd(null);
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [cooldownEnd]);

  const handleRefresh = useCallback(() => {
    forceRefresh();
    setCooldownEnd(Date.now() + REFRESH_COOLDOWN_MS);
    setRingKey((k) => k + 1);
  }, [forceRefresh]);

  const isCoolingDown = cooldownRemaining > 0;
  const cooldownSeconds = Math.ceil(cooldownRemaining / 1000);

  const size = 20;
  const r = (size - 2) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <button
      onClick={handleRefresh}
      disabled={isCoolingDown}
      className={`
        relative h-5 w-5 rounded flex items-center justify-center flex-shrink-0
        transition-all duration-200
        ${isCoolingDown
          ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
          : 'text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 cursor-pointer'
        }
      `}
      aria-label={isCoolingDown ? `Refresh available in ${cooldownSeconds}s` : 'Refresh now'}
      title={isCoolingDown ? `${cooldownSeconds}s` : 'Refresh now'}
    >
      {/* Cooldown ring */}
      {isCoolingDown && (
        <svg
          key={ringKey}
          width={size}
          height={size}
          className="absolute inset-0 m-auto -rotate-90"
          aria-hidden="true"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            opacity={0.15}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeDasharray={circumference}
            strokeDashoffset={0}
            strokeLinecap="round"
            style={{
              animation: `refresh-cooldown-ring ${REFRESH_COOLDOWN_MS}ms linear forwards`,
            }}
          />
        </svg>
      )}
      <svg
        width={12}
        height={12}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="relative z-10"
      >
        <path d="M1 1v5h5" />
        <path d="M3.51 10a6 6 0 1 0 .49-5L1 6" />
      </svg>
    </button>
  );
}

export function CountdownRing({ durationMs, size = 16 }: { durationMs: number; size?: number }) {
  const r = (size - 2) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <svg
      width={size}
      height={size}
      className="absolute inset-0 -rotate-90"
      aria-hidden="true"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        opacity={0.2}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeDasharray={circumference}
        strokeDashoffset={0}
        strokeLinecap="round"
        style={{
          animation: `countdown-ring ${durationMs}ms linear infinite`,
        }}
      />
    </svg>
  );
}
