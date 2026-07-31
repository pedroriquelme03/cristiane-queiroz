const blocos = ["kpi-1", "kpi-2", "kpi-3", "kpi-4"];

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="space-y-2">
        <div className="h-5 w-40 animate-pulse rounded bg-surface-muted" />
        <div className="h-8 w-72 max-w-full animate-pulse rounded bg-surface-muted" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {blocos.map((bloco) => (
          <div
            key={bloco}
            className="h-28 animate-pulse rounded-lg border border-border bg-surface"
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="h-80 animate-pulse rounded-lg border border-border bg-surface" />
        <div className="h-80 animate-pulse rounded-lg border border-border bg-surface" />
      </div>
    </div>
  );
}
