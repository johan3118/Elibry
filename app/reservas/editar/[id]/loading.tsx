export default function LoadingEditarReserva() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Skeleton */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-gray-200 rounded animate-pulse"></div>
            <div>
              <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-1"></div>
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>
          <div className="h-10 w-24 bg-gray-200 rounded animate-pulse"></div>
        </div>
      </header>

      <div className="p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Cards Skeleton */}
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mb-4"></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="space-y-2">
                    <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-10 w-full bg-gray-200 rounded animate-pulse"></div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Buttons Skeleton */}
          <div className="flex justify-end space-x-4">
            <div className="h-10 w-24 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-10 w-36 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>
  )
}
