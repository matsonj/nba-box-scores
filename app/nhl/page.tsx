import { nhlConfig } from '@/lib/sports/nhl';

export const metadata = {
  title: 'NHL Box Scores',
  description: 'Live NHL scores and box scores',
};

export default function NhlPage() {
  return (
    <div className="container mx-auto px-4 py-8 font-mono">
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <h2 className="text-2xl font-bold mb-4">{nhlConfig.displayName} Box Scores</h2>
        <p className="text-gray-600 dark:text-gray-400 text-lg">
          NHL data coming soon
        </p>
      </div>
    </div>
  );
}
