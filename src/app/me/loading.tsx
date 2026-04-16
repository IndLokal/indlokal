export default function MeLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Profile header skeleton */}
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-gray-200" />
        <div className="space-y-2">
          <div className="h-5 w-40 rounded bg-gray-200" />
          <div className="h-4 w-56 rounded bg-gray-100" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="space-y-3">
        <div className="h-6 w-32 rounded bg-gray-200" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-lg bg-gray-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
