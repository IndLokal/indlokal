export default function CityLoading() {
  return (
    <div className="animate-pulse space-y-8">
      {/* Hero skeleton */}
      <div className="space-y-3">
        <div className="h-8 w-64 rounded bg-gray-200" />
        <div className="h-4 w-96 rounded bg-gray-100" />
        <div className="flex gap-4">
          <div className="h-10 w-32 rounded-lg bg-gray-100" />
          <div className="h-10 w-32 rounded-lg bg-gray-100" />
        </div>
      </div>

      {/* Event cards skeleton */}
      <div className="space-y-3">
        <div className="h-6 w-48 rounded bg-gray-200" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 rounded-xl bg-gray-100" />
          ))}
        </div>
      </div>

      {/* Community cards skeleton */}
      <div className="space-y-3">
        <div className="h-6 w-48 rounded bg-gray-200" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-36 rounded-xl bg-gray-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
