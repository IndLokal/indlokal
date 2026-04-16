export default function SubmitLoading() {
  return (
    <div className="mx-auto max-w-2xl animate-pulse space-y-6">
      <div className="h-8 w-64 rounded bg-gray-200" />
      <div className="h-4 w-full rounded bg-gray-100" />
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-24 rounded bg-gray-200" />
            <div className="h-10 w-full rounded-lg bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
