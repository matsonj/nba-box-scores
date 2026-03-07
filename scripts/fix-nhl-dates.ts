#!/usr/bin/env tsx
// One-time fix: re-fetch NHL schedule dates from the API and output
// SQL to fix game_date to the correct Eastern Time date.
// Usage: npx tsx scripts/fix-nhl-dates.ts > /tmp/nhl-date-fixes.sql
//        duckdb -c "ATTACH 'md:nhl_box_scores';" < /tmp/nhl-date-fixes.sql

function utcToEasternDate(utcStr: string): string {
  const d = new Date(utcStr);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

interface ScheduleGame {
  id: number;
  startTimeUTC: string;
}

interface GameWeekDay {
  date: string;
  games: ScheduleGame[];
}

interface ScheduleResponse {
  gameWeek: GameWeekDay[];
  nextStartDate?: string;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

async function fetchSchedule(date: string): Promise<ScheduleResponse> {
  const url = `https://api-web.nhle.com/v1/schedule/${date}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json() as Promise<ScheduleResponse>;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const dateMap = new Map<string, string>();

  let currentDate = '2015-10-01';
  const endDate = '2026-07-01';
  let fetches = 0;

  console.error('Scanning NHL schedule API for correct dates...');

  while (currentDate < endDate) {
    try {
      const schedule = await fetchSchedule(currentDate);
      fetches++;

      for (const day of schedule.gameWeek) {
        for (const game of day.games) {
          if (game.startTimeUTC) {
            const etDate = utcToEasternDate(game.startTimeUTC);
            dateMap.set(String(game.id), etDate);
          }
        }
      }

      if (schedule.nextStartDate) {
        currentDate = schedule.nextStartDate;
      } else {
        currentDate = addDays(currentDate, 7);
      }

      if (fetches % 50 === 0) {
        console.error(`  ${fetches} API calls, ${dateMap.size} games mapped, at ${currentDate}`);
      }

      await sleep(150);
    } catch (err) {
      console.error(`  Failed at ${currentDate}: ${(err as Error).message}, skipping week`);
      currentDate = addDays(currentDate, 7);
    }
  }

  console.error(`Done scanning: ${dateMap.size} games from ${fetches} API calls`);

  // Output SQL
  console.log(`ATTACH IF NOT EXISTS 'md:nhl_box_scores';`);

  // Build a single UPDATE using CASE
  const entries = [...dateMap.entries()];
  const batchSize = 1000;

  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    const gameIds = batch.map(([gid]) => `'${gid}'`).join(',');
    const cases = batch.map(([gid, d]) => `WHEN '${gid}' THEN '${d}'::TIMESTAMP`).join(' ');

    console.log(`UPDATE nhl_box_scores.main.schedule SET game_date = CASE game_id ${cases} END WHERE game_id IN (${gameIds});`);
  }

  console.error('SQL output complete.');
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
