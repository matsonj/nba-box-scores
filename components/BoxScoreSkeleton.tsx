'use client';

export default function BoxScoreSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Header skeleton */}
      <div className="mb-6">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 mx-auto"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mx-auto mt-2"></div>
      </div>

      {/* Box score table skeleton */}
      <div className="space-y-8">
        {/* Away team */}
        <div>
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4"></div>
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={`away-${i}`} className="flex space-x-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-8"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-8"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-8"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-8"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Home team */}
        <div>
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4"></div>
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={`home-${i}`} className="flex space-x-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-8"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-8"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-8"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-8"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
