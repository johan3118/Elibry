export default function RegistrarComprobanteLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Skeleton */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-32 h-8 bg-gray-200 rounded animate-pulse"></div>
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-gray-200 rounded animate-pulse"></div>
              <div>
                <div className="w-72 h-6 bg-gray-200 rounded animate-pulse mb-1"></div>
                <div className="w-56 h-4 bg-gray-200 rounded animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Form Card Skeleton */}
          <div className="bg-white rounded-lg border">
            <div className="p-6">
              <div className="w-64 h-6 bg-gray-200 rounded animate-pulse mb-2"></div>
              <div className="w-48 h-4 bg-gray-200 rounded animate-pulse mb-6"></div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="w-32 h-4 bg-gray-200 rounded animate-pulse"></div>
                    <div className="w-full h-10 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Summary Card Skeleton */}
          <div className="bg-white rounded-lg border">
            <div className="p-6">
              <div className="w-48 h-6 bg-gray-200 rounded animate-pulse mb-2"></div>
              <div className="w-40 h-4 bg-gray-200 rounded animate-pulse mb-6"></div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="w-24 h-4 bg-gray-200 rounded animate-pulse"></div>
                        <div className="w-16 h-6 bg-gray-200 rounded animate-pulse"></div>
                      </div>
                      <div className="w-8 h-8 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Observaciones Card Skeleton */}
          <div className="bg-white rounded-lg border">
            <div className="p-6">
              <div className="w-32 h-6 bg-gray-200 rounded animate-pulse mb-2"></div>
              <div className="w-56 h-4 bg-gray-200 rounded animate-pulse mb-6"></div>
              <div className="w-full h-20 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>

          {/* Warning Card Skeleton */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="p-4">
              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 bg-yellow-200 rounded animate-pulse mt-0.5"></div>
                <div className="flex-1">
                  <div className="w-20 h-4 bg-yellow-200 rounded animate-pulse mb-2"></div>
                  <div className="w-full h-4 bg-yellow-200 rounded animate-pulse mb-1"></div>
                  <div className="w-3/4 h-4 bg-yellow-200 rounded animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Buttons Skeleton */}
          <div className="flex justify-end space-x-4">
            <div className="w-20 h-10 bg-gray-200 rounded animate-pulse"></div>
            <div className="w-32 h-10 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>
  )
}
