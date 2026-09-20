/** Shown by the route-level loading states while the server query runs. */
export function PageSkeleton({ rows = 3, label = "Cargando..." }: { rows?: number; label?: string }) {
  return <div role="status" aria-live="polite" className="animate-pulse py-12 sm:py-16">
    <span className="sr-only">{label}</span>
    <div className="h-4 w-32 rounded-full bg-[#e2e9e1]" />
    <div className="mt-4 h-11 w-2/3 max-w-xl rounded-2xl bg-[#e2e9e1]" />
    <div className="mt-4 h-4 w-1/2 max-w-md rounded-full bg-[#e9eee8]" />
    <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => <div key={index} className="h-52 rounded-2xl border border-border bg-surface" />)}
    </div>
  </div>;
}
