export function DeploymentLogs({ logs }: { logs?: string | null }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background p-4">
      <p className="text-sm font-semibold text-muted-foreground">Build logs</p>
      <pre className="mt-3 max-h-[420px] overflow-auto rounded-xl bg-black/90 p-4 text-xs text-white">
        {logs ?? 'Logs will appear here once available.'}
      </pre>
    </div>
  )
}


