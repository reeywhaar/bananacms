// Suspense fallback shown while a block's data is loading
export function BlockSkeleton() {
  return (
    <div aria-busy className="animate-pulse rounded-2xl border border-amber-100 bg-white/60 p-6">
      <div className="h-6 w-1/3 rounded bg-amber-100" />
      <div className="mt-5 space-y-3">
        <div className="h-3 rounded bg-amber-100" />
        <div className="h-3 w-5/6 rounded bg-amber-100" />
        <div className="h-3 w-2/3 rounded bg-amber-100" />
      </div>
    </div>
  )
}
