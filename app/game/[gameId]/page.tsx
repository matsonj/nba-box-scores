import BoxScore from '@/components/BoxScore';

export default function GamePage({ params }: { params: { gameId: string } }) {
  return (
    <main className="container mx-auto py-8">
      <BoxScore gameId={params.gameId} />
    </main>
  );
}
