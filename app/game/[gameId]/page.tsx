import { format, parseISO } from 'date-fns';

interface PlayerStats {
  game_id: string;
  team_id: string;
  entity_id: string;
  playerName: string;
  minutes: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fgMade: number;
  fgAttempted: number;
  fg3Made: number;
  fg3Attempted: number;
  ftMade: number;
  ftAttempted: number;
  plus_minus: number;
  starter: boolean;
  period: string;
}

interface TeamStats {
  game_id: string;
  team_id: string;
  period: string;
  minutes: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fgMade: number;
  fgAttempted: number;
  fg3Made: number;
  fg3Attempted: number;
  ftMade: number;
  ftAttempted: number;
  offensive_possessions: number;
  defensive_possessions: number;
}

interface Team extends TeamStats {
  teamId: string;
  teamName: string;
  teamAbbreviation: string;
  score: number;
  players: PlayerStats[];
}

interface Game {
  game_id: string;
  game_date: string;
  home_team_id: string;
  away_team_id: string;
  home_team_score: number;
  away_team_score: number;
  status: string;
  home_team_abbreviation: string;
  away_team_abbreviation: string;
}

interface BoxScore {
  gameInfo: Game;
  teams: Team[];
}

type PageParams = {
  gameId: string;
}

interface Props {
  params: PageParams;
  searchParams: { [key: string]: string | string[] | undefined };
}

interface Metadata {
  title: string;
}

async function getBoxScore(gameId: string): Promise<BoxScore> {
  // Get the protocol and host from the headers
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const host = process.env.VERCEL_URL || 'localhost:3000';

  // Make the request to the API
  const response = await fetch(`${protocol}://${host}/api/box-scores/${gameId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch box score');
  }
  return response.json();
}

export async function generateMetadata(
  { params }: Props
): Promise<Metadata> {
  // Get the game data to show team names in the title
  const boxScore = await getBoxScore(params.gameId);
  return {
    title: `${boxScore.gameInfo.away_team_abbreviation} @ ${boxScore.gameInfo.home_team_abbreviation} - NBA Box Scores`,
  };
}

export default async function GamePage(
  { params, searchParams }: Props
) {
  if (!params.gameId) {
    throw new Error('Game ID is required');
  }

  const boxScore = await getBoxScore(params.gameId);
  const { gameInfo, teams } = boxScore;

  console.log('Game info:', gameInfo);
  console.log('Teams:', teams);

  // Find home and away teams
  const homeTeam = teams.find(team => team.teamId === String(gameInfo.home_team_id));
  const awayTeam = teams.find(team => team.teamId === String(gameInfo.away_team_id));

  console.log('Found home team:', homeTeam);
  console.log('Found away team:', awayTeam);
  console.log('Looking for home team ID:', String(gameInfo.home_team_id));
  console.log('Looking for away team ID:', String(gameInfo.away_team_id));

  if (!homeTeam || !awayTeam) {
    throw new Error('Failed to find team data');
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-4">
          {gameInfo.away_team_abbreviation} @ {gameInfo.home_team_abbreviation}
        </h1>
        <p className="text-xl mb-2">
          {format(parseISO(gameInfo.game_date), 'MMMM d, yyyy')}
        </p>
        <p className="text-2xl font-bold">
          {gameInfo.away_team_score} - {gameInfo.home_team_score}
        </p>
        <p className="text-gray-600">{gameInfo.status}</p>
      </div>

      {[awayTeam, homeTeam].map((team) => (
        <div key={team.teamId} className="mb-8">
          <h2 className="text-2xl font-bold mb-4">{team.teamName}</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto">
              <thead>
                <tr className="bg-gray-200">
                  <th className="px-4 py-2 text-left">Player</th>
                  <th className="px-4 py-2 text-right">MIN</th>
                  <th className="px-4 py-2 text-right">PTS</th>
                  <th className="px-4 py-2 text-right">REB</th>
                  <th className="px-4 py-2 text-right">AST</th>
                  <th className="px-4 py-2 text-right">STL</th>
                  <th className="px-4 py-2 text-right">BLK</th>
                  <th className="px-4 py-2 text-right">TO</th>
                  <th className="px-4 py-2 text-right">FG</th>
                  <th className="px-4 py-2 text-right">3P</th>
                  <th className="px-4 py-2 text-right">FT</th>
                  <th className="px-4 py-2 text-right">+/-</th>
                </tr>
              </thead>
              <tbody>
                {team.players.map((player) => (
                  <tr key={player.entity_id} className="border-b">
                    <td className="px-4 py-2">{player.playerName}</td>
                    <td className="px-4 py-2 text-right">{player.minutes}</td>
                    <td className="px-4 py-2 text-right">{player.points}</td>
                    <td className="px-4 py-2 text-right">{player.rebounds}</td>
                    <td className="px-4 py-2 text-right">{player.assists}</td>
                    <td className="px-4 py-2 text-right">{player.steals}</td>
                    <td className="px-4 py-2 text-right">{player.blocks}</td>
                    <td className="px-4 py-2 text-right">{player.turnovers}</td>
                    <td className="px-4 py-2 text-right">
                      {player.fgMade}-{player.fgAttempted}
                      <span className="text-gray-500 text-sm ml-1">
                        ({calculatePercentage(player.fgMade, player.fgAttempted)}%)
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {player.fg3Made}-{player.fg3Attempted}
                      <span className="text-gray-500 text-sm ml-1">
                        ({calculatePercentage(player.fg3Made, player.fg3Attempted)}%)
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {player.ftMade}-{player.ftAttempted}
                      <span className="text-gray-500 text-sm ml-1">
                        ({calculatePercentage(player.ftMade, player.ftAttempted)}%)
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">{player.plus_minus}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-bold">
                  <td className="px-4 py-2">Team Totals</td>
                  <td className="px-4 py-2 text-right">-</td>
                  <td className="px-4 py-2 text-right">{team.points}</td>
                  <td className="px-4 py-2 text-right">{team.rebounds}</td>
                  <td className="px-4 py-2 text-right">{team.assists}</td>
                  <td className="px-4 py-2 text-right">{team.steals}</td>
                  <td className="px-4 py-2 text-right">{team.blocks}</td>
                  <td className="px-4 py-2 text-right">{team.turnovers}</td>
                  <td className="px-4 py-2 text-right">
                    {team.fgMade}-{team.fgAttempted}
                    <span className="text-gray-500 text-sm ml-1">
                      ({calculatePercentage(team.fgMade, team.fgAttempted)}%)
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {team.fg3Made}-{team.fg3Attempted}
                    <span className="text-gray-500 text-sm ml-1">
                      ({calculatePercentage(team.fg3Made, team.fg3Attempted)}%)
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {team.ftMade}-{team.ftAttempted}
                    <span className="text-gray-500 text-sm ml-1">
                      ({calculatePercentage(team.ftMade, team.ftAttempted)}%)
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">-</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function calculatePercentage(made: number, attempted: number): string {
  if (attempted === 0) return '0.0';
  return ((made / attempted) * 100).toFixed(1);
}
