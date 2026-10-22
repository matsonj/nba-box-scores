// ESPN's public site API is the source for NBA live data. cdn.nba.com (Akamai)
// returns 403 to datacenter IPs, including Vercel, regardless of headers.
export const ESPN_NBA_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';

// ESPN abbreviations that differ from NBA tricodes
const ESPN_TO_NBA_TRICODE: Record<string, string> = {
  GS: 'GSW',
  NO: 'NOP',
  NY: 'NYK',
  SA: 'SAS',
  UTAH: 'UTA',
  WSH: 'WAS',
};

export function toNbaTricode(espnAbbrev: unknown): string {
  const abbrev = String(espnAbbrev || '');
  return ESPN_TO_NBA_TRICODE[abbrev] || abbrev;
}
