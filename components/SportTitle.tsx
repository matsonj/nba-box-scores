'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { getSportConfig } from '@/lib/sports';
import type { Sport } from '@/lib/sports';
import { getSportFromPathname } from '@/lib/sportUtils';

function getOtherRoute(sport: Sport): string {
  return sport === 'nba' ? '/nhl' : '/';
}

export default function SportTitle() {
  const pathname = usePathname();
  const router = useRouter();
  const sport = getSportFromPathname(pathname ?? '/');
  const config = getSportConfig(sport);

  useEffect(() => {
    document.title = `${config.displayName} Box Scores`;
  }, [config.displayName]);

  useEffect(() => {
    try {
      localStorage.setItem('lastSport', sport);
    } catch {
      // localStorage not available
    }
  }, [sport]);

  const handleClick = () => {
    const targetRoute = getOtherRoute(sport);
    router.push(targetRoute);
  };

  return (
    <div className="flex items-end gap-3 min-w-0">
      <h1 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white whitespace-nowrap">
        <span onClick={handleClick} className="cursor-pointer">
          {config.displayName}
        </span>
        {' '}Box Scores
      </h1>
      <span className="hidden md:inline text-lg italic text-gray-600 dark:text-gray-400">
        {config.subtitle}
      </span>
    </div>
  );
}
