import BoxScore from '@/components/BoxScore';
import { Team } from '@/types';

interface BoxScoreResponse {
  gameInfo: {
    game_id: string;
    gameDate: string;
    home_team_abbreviation: string;
    away_team_abbreviation: string;
    home_team_score: number;
    away_team_score: number;
    status: string;
  };
  homeTeam: Team;
  awayTeam: Team;
}

async function getBoxScore(gameId: string): Promise<BoxScoreResponse> {
  const res = await fetch(`/api/box-scores/${gameId}`, {
    next: { revalidate: 30 }, // Revalidate every 30 seconds
  });
  
  if (!res.ok) {
    throw new Error('Failed to fetch box score');
  }
  
  return res.json();
}

export default async function GamePage({ params }: { params: { gameId: string } }) {
  const data = await getBoxScore(params.gameId);
  
  return (
    <main className="container mx-auto py-8">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">
          {data.gameInfo.away_team_abbreviation} @ {data.gameInfo.home_team_abbreviation}
        </h1>
        <p className="text-gray-600">
          {data.gameInfo.status} - {data.gameInfo.gameDate}
        </p>
        <p className="text-xl">
          {data.gameInfo.away_team_score} - {data.gameInfo.home_team_score}
        </p>
      </div>
      <BoxScore homeTeam={data.homeTeam} awayTeam={data.awayTeam} />
    </main>
  );
}
