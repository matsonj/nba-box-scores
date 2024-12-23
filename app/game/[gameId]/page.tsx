import { format, parseISO } from 'date-fns';
import Link from 'next/link';

interface PlayerStats {
  gameId: string;
  teamId: number;
  entityId: string;
  playerName: string;
  minutes: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  threePointersMade: number;
  threePointersAttempted: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  plusMinus: number;
  starter: boolean;
  period: string;
}

interface TeamStats {
  game_id: string;
  team_id: number;
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
  teamId: number;
  teamName: string;
  teamAbbreviation: string;
  score: number;
  players: PlayerStats[];
}

interface Game {
  game_id: string;
  game_date: string;
  home_team_id: number;
  away_team_id: number;
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
  params: Promise<PageParams>;
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
  { params }: { params: Promise<PageParams> }
): Promise<Metadata> {
  // Get the game data to show team names in the title
  const resolvedParams = await params;
  const boxScore = await getBoxScore(resolvedParams.gameId);
  return {
    title: `${boxScore.gameInfo.away_team_abbreviation} @ ${boxScore.gameInfo.home_team_abbreviation} - NBA Box Scores`,
  };
}

export default async function GamePage(
  { params, searchParams }: Props
) {
  const resolvedParams = await params;
  if (!resolvedParams.gameId) {
    throw new Error('Game ID is required');
  }

  const boxScore = await getBoxScore(resolvedParams.gameId);
  const { gameInfo, teams } = boxScore;

  console.log('Game info:', gameInfo);
  console.log('Teams:', teams);

  // Find home and away teams
  const homeTeam = teams.find(team => team.teamId === gameInfo.home_team_id);
  const awayTeam = teams.find(team => team.teamId === gameInfo.away_team_id);

  console.log('Found home team:', homeTeam);
  console.log('Found away team:', awayTeam);
  console.log('Looking for home team ID:', gameInfo.home_team_id);
  console.log('Looking for away team ID:', gameInfo.away_team_id);

  if (!homeTeam || !awayTeam) {
    throw new Error('Failed to find team data');
  }

  return (
    <div className="container mx-auto px-4 py-8 font-mono print:p-2 print:max-w-none">
      <div className="relative">
        <Link href="/" className="absolute left-0 top-0 text-2xl text-gray-600 hover:text-black print:hidden">←</Link>
        <div className="text-center mb-8 print:mb-4">
          <div className="text-2xl font-bold mb-2 print:text-xl">
            <span className={gameInfo.away_team_score > gameInfo.home_team_score ? "" : "text-gray-500 print:text-black"}>
              {gameInfo.away_team_score > gameInfo.home_team_score ? "* " : ""}
              {gameInfo.away_team_abbreviation} {gameInfo.away_team_score}
            </span>
            <span className="text-gray-500 print:text-black"> @ </span>
            <span className={gameInfo.home_team_score > gameInfo.away_team_score ? "" : "text-gray-500 print:text-black"}>
              {gameInfo.home_team_score} {gameInfo.home_team_abbreviation}
              {gameInfo.home_team_score > gameInfo.away_team_score ? " *" : ""}
            </span>
          </div>
          <p className="text-lg text-gray-600 print:text-sm print:text-black">
            {format(parseISO(gameInfo.game_date), 'MMMM d, yyyy • h:mm a')}
          </p>
        </div>

        {[awayTeam, homeTeam].map((team) => (
          <div key={team.teamId} className="mb-8 print:mb-4">
            <h2 className="text-xl font-bold mb-4 print:text-lg print:mb-2">{team.teamName}</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto print:text-xs">
                <thead>
                  <tr className="bg-gray-200 print:bg-transparent print:border-b">
                    <th className="px-3 py-1 text-left print:px-2">Player</th>
                    <th className="px-3 py-1 text-right print:px-2">MIN</th>
                    <th className="px-3 py-1 text-right print:px-2">PTS</th>
                    <th className="px-3 py-1 text-right print:px-2">REB</th>
                    <th className="px-3 py-1 text-right print:px-2">AST</th>
                    <th className="px-3 py-1 text-right print:px-2">STL</th>
                    <th className="px-3 py-1 text-right print:px-2">BLK</th>
                    <th className="px-3 py-1 text-right print:px-2">TO</th>
                    <th className="px-3 py-1 text-right print:px-2">FG</th>
                    <th className="px-3 py-1 text-right print:px-2">FG%</th>
                    <th className="px-3 py-1 text-right print:px-2">3P</th>
                    <th className="px-3 py-1 text-right print:px-2">3P%</th>
                    <th className="px-3 py-1 text-right print:px-2">FT</th>
                    <th className="px-3 py-1 text-right print:px-2">FT%</th>
                  </tr>
                </thead>
                <tbody>
                  {team.players.map((player) => (
                    <tr key={player.entityId} className="border-b print:border-dotted">
                      <td className="px-3 py-1 print:px-2 print:py-0.5">{player.playerName}</td>
                      <td className="px-3 py-1 text-right print:px-2 print:py-0.5">{player.minutes}</td>
                      <td className="px-3 py-1 text-right print:px-2 print:py-0.5">{player.points}</td>
                      <td className="px-3 py-1 text-right print:px-2 print:py-0.5">{player.rebounds}</td>
                      <td className="px-3 py-1 text-right print:px-2 print:py-0.5">{player.assists}</td>
                      <td className="px-3 py-1 text-right print:px-2 print:py-0.5">{player.steals}</td>
                      <td className="px-3 py-1 text-right print:px-2 print:py-0.5">{player.blocks}</td>
                      <td className="px-3 py-1 text-right print:px-2 print:py-0.5">{player.turnovers}</td>
                      <td className="px-3 py-1 text-right print:px-2 print:py-0.5">
                        {player.fieldGoalsMade}-{player.fieldGoalsAttempted}
                      </td>
                      <td className="px-3 py-1 text-right print:px-2 print:py-0.5">
                        {calculatePercentage(player.fieldGoalsMade, player.fieldGoalsAttempted)}
                      </td>
                      <td className="px-3 py-1 text-right print:px-2 print:py-0.5">
                        {player.threePointersMade}-{player.threePointersAttempted}
                      </td>
                      <td className="px-3 py-1 text-right print:px-2 print:py-0.5">
                        {calculatePercentage(player.threePointersMade, player.threePointersAttempted)}
                      </td>
                      <td className="px-3 py-1 text-right print:px-2 print:py-0.5">
                        {player.freeThrowsMade}-{player.freeThrowsAttempted}
                      </td>
                      <td className="px-3 py-1 text-right print:px-2 print:py-0.5">
                        {calculatePercentage(player.freeThrowsMade, player.freeThrowsAttempted)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold print:border-t print:text-xs">
                    <td className="px-3 py-1 print:px-2 print:py-0.5">Team Totals</td>
                    <td className="px-3 py-1 text-right print:px-2 print:py-0.5">{calculateTeamTotals(team.players).minutes}</td>
                    <td className="px-3 py-1 text-right print:px-2 print:py-0.5">{calculateTeamTotals(team.players).points}</td>
                    <td className="px-3 py-1 text-right print:px-2 print:py-0.5">{calculateTeamTotals(team.players).rebounds}</td>
                    <td className="px-3 py-1 text-right print:px-2 print:py-0.5">{calculateTeamTotals(team.players).assists}</td>
                    <td className="px-3 py-1 text-right print:px-2 print:py-0.5">{calculateTeamTotals(team.players).steals}</td>
                    <td className="px-3 py-1 text-right print:px-2 print:py-0.5">{calculateTeamTotals(team.players).blocks}</td>
                    <td className="px-3 py-1 text-right print:px-2 print:py-0.5">{calculateTeamTotals(team.players).turnovers}</td>
                    <td className="px-3 py-1 text-right print:px-2 print:py-0.5">
                      {calculateTeamTotals(team.players).fieldGoalsMade}-{calculateTeamTotals(team.players).fieldGoalsAttempted}
                    </td>
                    <td className="px-3 py-1 text-right print:px-2 print:py-0.5">
                      {calculatePercentage(calculateTeamTotals(team.players).fieldGoalsMade, calculateTeamTotals(team.players).fieldGoalsAttempted)}
                    </td>
                    <td className="px-3 py-1 text-right print:px-2 print:py-0.5">
                      {calculateTeamTotals(team.players).threePointersMade}-{calculateTeamTotals(team.players).threePointersAttempted}
                    </td>
                    <td className="px-3 py-1 text-right print:px-2 print:py-0.5">
                      {calculatePercentage(calculateTeamTotals(team.players).threePointersMade, calculateTeamTotals(team.players).threePointersAttempted)}
                    </td>
                    <td className="px-3 py-1 text-right print:px-2 print:py-0.5">
                      {calculateTeamTotals(team.players).freeThrowsMade}-{calculateTeamTotals(team.players).freeThrowsAttempted}
                    </td>
                    <td className="px-3 py-1 text-right print:px-2 print:py-0.5">
                      {calculatePercentage(calculateTeamTotals(team.players).freeThrowsMade, calculateTeamTotals(team.players).freeThrowsAttempted)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function calculatePercentage(made: number, attempted: number): string {
  if (attempted === 0) return '.000';
  const percentage = made / attempted;
  return percentage >= 1 ? '1.000' : percentage.toFixed(3).substring(1);
}

function parseMinutes(timeStr: string): number {
  const [minutes, seconds] = timeStr.split(':').map(Number);
  return minutes * 60 + seconds;
}

function formatMinutes(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function calculateTeamTotals(players: PlayerStats[]): {
  minutes: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  threePointersMade: number;
  threePointersAttempted: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
} {
  const totals = players.reduce((acc, player) => {
    const seconds = parseMinutes(player.minutes);
    return {
      seconds: acc.seconds + seconds,
      points: acc.points + player.points,
      rebounds: acc.rebounds + player.rebounds,
      assists: acc.assists + player.assists,
      steals: acc.steals + player.steals,
      blocks: acc.blocks + player.blocks,
      turnovers: acc.turnovers + player.turnovers,
      fieldGoalsMade: acc.fieldGoalsMade + player.fieldGoalsMade,
      fieldGoalsAttempted: acc.fieldGoalsAttempted + player.fieldGoalsAttempted,
      threePointersMade: acc.threePointersMade + player.threePointersMade,
      threePointersAttempted: acc.threePointersAttempted + player.threePointersAttempted,
      freeThrowsMade: acc.freeThrowsMade + player.freeThrowsMade,
      freeThrowsAttempted: acc.freeThrowsAttempted + player.freeThrowsAttempted,
    };
  }, {
    seconds: 0,
    points: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    threePointersMade: 0,
    threePointersAttempted: 0,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
  });

  return {
    minutes: formatMinutes(totals.seconds),
    points: totals.points,
    rebounds: totals.rebounds,
    assists: totals.assists,
    steals: totals.steals,
    blocks: totals.blocks,
    turnovers: totals.turnovers,
    fieldGoalsMade: totals.fieldGoalsMade,
    fieldGoalsAttempted: totals.fieldGoalsAttempted,
    threePointersMade: totals.threePointersMade,
    threePointersAttempted: totals.threePointersAttempted,
    freeThrowsMade: totals.freeThrowsMade,
    freeThrowsAttempted: totals.freeThrowsAttempted,
  };
}
