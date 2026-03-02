export const TEAM_ABBREVIATIONS = [
  'ATL','BOS','BKN','CHA','CHI','CLE','DAL','DEN','DET','GSW',
  'HOU','IND','LAC','LAL','MEM','MIA','MIL','MIN','NOP','NYK',
  'OKC','ORL','PHI','PHX','POR','SAC','SAS','TOR','UTA','WAS'
] as const;

export const teamNames: Record<string, string> = {
  'ATL': 'Atlanta Hawks',
  'BOS': 'Boston Celtics',
  'BKN': 'Brooklyn Nets',
  'CHA': 'Charlotte Hornets',
  'CHI': 'Chicago Bulls',
  'CLE': 'Cleveland Cavaliers',
  'DAL': 'Dallas Mavericks',
  'DEN': 'Denver Nuggets',
  'DET': 'Detroit Pistons',
  'GSW': 'Golden State Warriors',
  'HOU': 'Houston Rockets',
  'IND': 'Indiana Pacers',
  'LAC': 'Los Angeles Clippers',
  'LAL': 'Los Angeles Lakers',
  'MEM': 'Memphis Grizzlies',
  'MIA': 'Miami Heat',
  'MIL': 'Milwaukee Bucks',
  'MIN': 'Minnesota Timberwolves',
  'NOP': 'New Orleans Pelicans',
  'NYK': 'New York Knicks',
  'OKC': 'Oklahoma City Thunder',
  'ORL': 'Orlando Magic',
  'PHI': 'Philadelphia 76ers',
  'PHX': 'Phoenix Suns',
  'POR': 'Portland Trail Blazers',
  'SAC': 'Sacramento Kings',
  'SAS': 'San Antonio Spurs',
  'TOR': 'Toronto Raptors',
  'UTA': 'Utah Jazz',
  'WAS': 'Washington Wizards'
};

export function getTeamName(abbreviation: string): string {
  return teamNames[abbreviation] || abbreviation;
}
