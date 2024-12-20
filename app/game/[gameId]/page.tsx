import { format, parseISO } from 'date-fns';

interface PlayerStats {
  game_id: string;
  team_id: string;
  entity_id: string;
  player_name: string;
  minutes: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fg_made: number;
  fg_attempted: number;
  fg3_made: number;
  fg3_attempted: number;
  ft_made: number;
  ft_attempted: number;
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
  fg_made: number;
  fg_attempted: number;
  fg3_made: number;
  fg3_attempted: number;
  ft_made: number;
  ft_attempted: number;
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
}

interface BoxScore {
  gameInfo: Game;
  homeTeam: Team;
  awayTeam: Team;
}

interface Props {
  params: { gameId: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

async function getBoxScore(gameId: string): Promise<BoxScore> {
  // Get the protocol and host from the headers
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const host = process.env.VERCEL_URL || 'localhost:3000';
  
  const res = await fetch(`${protocol}://${host}/api/box-scores/${gameId}`, {
    next: { revalidate: 30 }, // Revalidate every 30 seconds
  });
  
  if (!res.ok) {
    throw new Error('Failed to fetch box score');
  }
  
  return res.json();
}

function calculatePercentage(made: number, attempted: number): string {
  if (attempted === 0) return '0.0';
  return ((made / attempted) * 100).toFixed(1);
}

export async function generateMetadata(
  { params, searchParams }: Props
): Promise<Metadata> {
  return {
    title: `Game ${params.gameId} - NBA Box Scores`,
  };
}

export default async function GamePage(
  { params, searchParams }: Props
) {
  // Validate and process the gameId parameter
  if (!params.gameId) {
    throw new Error('Game ID is required');
  }

  const boxScore = await getBoxScore(params.gameId);
  const { gameInfo, homeTeam, awayTeam } = boxScore;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-4">
          {gameInfo.away_team_id} @ {gameInfo.home_team_id}
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
                    <td className="px-4 py-2">{player.player_name}</td>
                    <td className="px-4 py-2 text-right">{player.minutes}</td>
                    <td className="px-4 py-2 text-right">{player.points}</td>
                    <td className="px-4 py-2 text-right">{player.rebounds}</td>
                    <td className="px-4 py-2 text-right">{player.assists}</td>
                    <td className="px-4 py-2 text-right">{player.steals}</td>
                    <td className="px-4 py-2 text-right">{player.blocks}</td>
                    <td className="px-4 py-2 text-right">{player.turnovers}</td>
                    <td className="px-4 py-2 text-right">
                      {player.fg_made}-{player.fg_attempted}
                      <span className="text-gray-500 text-sm ml-1">
                        ({calculatePercentage(player.fg_made, player.fg_attempted)}%)
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {player.fg3_made}-{player.fg3_attempted}
                      <span className="text-gray-500 text-sm ml-1">
                        ({calculatePercentage(player.fg3_made, player.fg3_attempted)}%)
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {player.ft_made}-{player.ft_attempted}
                      <span className="text-gray-500 text-sm ml-1">
                        ({calculatePercentage(player.ft_made, player.ft_attempted)}%)
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
                    {team.fg_made}-{team.fg_attempted}
                    <span className="text-gray-500 text-sm ml-1">
                      ({calculatePercentage(team.fg_made, team.fg_attempted)}%)
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {team.fg3_made}-{team.fg3_attempted}
                    <span className="text-gray-500 text-sm ml-1">
                      ({calculatePercentage(team.fg3_made, team.fg3_attempted)}%)
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {team.ft_made}-{team.ft_attempted}
                    <span className="text-gray-500 text-sm ml-1">
                      ({calculatePercentage(team.ft_made, team.ft_attempted)}%)
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
