export default function ComprobantesLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Skeleton */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-24 h-8 bg-gray-200 rounded animate-pulse"></div>
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-gray-200 rounded animate-pulse"></div>
              <div>
                <div className="w-64 h-6 bg-gray-200 rounded animate-pulse mb-1"></div>
                <div className="w-48 h-4 bg-gray-200 rounded animate-pulse"></div>
              </div>
            </div>
          </div>
          <div className="w-32 h-10 bg-gray-200 rounded animate-pulse"></div>
        </div>
      </header>

      <div className="p-6">
        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="w-20 h-4 bg-gray-200 rounded animate-pulse mb-2"></div>
                  <div className="w-12 h-8 bg-gray-200 rounded animate-pulse"></div>
                </div>
                <div className="w-8 h-8 bg-gray-200 rounded animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>

        {/* Search Card Skeleton */}
        <div className="bg-white rounded-lg border mb-6">
          <div className="p-6">
            <div className="w-48 h-6 bg-gray-200 rounded animate-pulse mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <div className="w-full h-10 bg-gray-200 rounded animate-pulse"></div>
              </div>
              <div className="w-full h-10 bg-gray-200 rounded animate-pulse"></div>
              <div className="w-full h-10 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Table Skeleton */}
        <div className="bg-white rounded-lg border">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="w-64 h-6 bg-gray-200 rounded animate-pulse mb-2"></div>
                <div className="w-32 h-4 bg-gray-200 rounded animate-pulse"></div>
              </div>
              <div className="w-24 h-8 bg-gray-200 rounded animate-pulse"></div>
            </div>
            
            {/* Table Header */}
            <div className="grid grid-cols-9 gap-4 pb-4 border-b">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                <div key={i} className="w-full h-4 bg-gray-200 rounded animate-pulse"></div>
              ))}
            </div>
            
            {/* Table Rows */}
            {[1, 2, 3, 4, 5].map((row) => (
              <div key={row} className="grid grid-cols-9 gap-4 py-4 border-b">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((col) => (
                  <div key={col} className="w-full h-4 bg-gray-200 rounded animate-pulse"></div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
