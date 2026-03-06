export const NHL_TEAM_ABBREVIATIONS = [
  'ANA','BOS','BUF','CGY','CAR','CHI','COL','CBJ','DAL','DET',
  'EDM','FLA','LAK','MIN','MTL','NSH','NJD','NYI','NYR','OTT',
  'PHI','PIT','SEA','SJS','STL','TBL','TOR','UTA','VAN','VGK',
  'WPG','WSH'
] as const;

export const nhlTeamNames: Record<string, string> = {
  'ANA': 'Anaheim Ducks',
  'BOS': 'Boston Bruins',
  'BUF': 'Buffalo Sabres',
  'CGY': 'Calgary Flames',
  'CAR': 'Carolina Hurricanes',
  'CHI': 'Chicago Blackhawks',
  'COL': 'Colorado Avalanche',
  'CBJ': 'Columbus Blue Jackets',
  'DAL': 'Dallas Stars',
  'DET': 'Detroit Red Wings',
  'EDM': 'Edmonton Oilers',
  'FLA': 'Florida Panthers',
  'LAK': 'Los Angeles Kings',
  'MIN': 'Minnesota Wild',
  'MTL': 'Montreal Canadiens',
  'NSH': 'Nashville Predators',
  'NJD': 'New Jersey Devils',
  'NYI': 'New York Islanders',
  'NYR': 'New York Rangers',
  'OTT': 'Ottawa Senators',
  'PHI': 'Philadelphia Flyers',
  'PIT': 'Pittsburgh Penguins',
  'SEA': 'Seattle Kraken',
  'SJS': 'San Jose Sharks',
  'STL': 'St. Louis Blues',
  'TBL': 'Tampa Bay Lightning',
  'TOR': 'Toronto Maple Leafs',
  'UTA': 'Utah Hockey Club',
  'VAN': 'Vancouver Canucks',
  'VGK': 'Vegas Golden Knights',
  'WPG': 'Winnipeg Jets',
  'WSH': 'Washington Capitals',
};

export function getNHLTeamName(idOrAbbrev: string): string {
  return nhlTeamNames[idOrAbbrev] || idOrAbbrev;
}
