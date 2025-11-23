import { Terminal, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useState } from 'react'

export function DeploymentLogs({ logs }: { logs?: string | null }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (logs) {
      navigator.clipboard.writeText(logs)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Terminal className="h-4 w-4 text-primary" />
          Build Logs
        </CardTitle>
        {logs && (
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy
              </>
            )}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <pre className="max-h-[420px] overflow-auto rounded-lg bg-black p-4 text-xs text-green-400 font-mono leading-relaxed border">
        {logs ?? 'Logs will appear here once available.'}
      </pre>
      </CardContent>
    </Card>
  )
}
