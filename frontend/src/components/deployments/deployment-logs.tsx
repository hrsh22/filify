import { Terminal } from 'lucide-react'

export function DeploymentLogs({ logs }: { logs?: string | null }) {
  return (
    <div className="space-y-4 rounded-xl bg-card border border-border p-7 shadow-neo">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary border border-primary shadow-neo-sm">
          <Terminal className="h-4 w-4 text-white" />
        </div>
        <p className="text-sm font-bold uppercase tracking-wide text-primary">Build logs</p>
      </div>
      <pre className="max-h-[420px] overflow-auto rounded-xl bg-black/95 p-5 text-xs font-medium text-green-400 shadow-neo-inset font-mono leading-relaxed">
        {logs ?? 'Logs will appear here once available.'}
      </pre>
    </div>
  )
}


