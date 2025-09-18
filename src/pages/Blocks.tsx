import { useEffect, useState } from 'react'
import { blockPalette } from '../mocks/blocks.ts'
import { apiClient } from '../api/client'

function Blocks() {
  const [specs, setSpecs] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    apiClient.getBlockSpecs().then((r) => setSpecs(r.blocks as Record<string, unknown>)).catch(() => setSpecs(null))
  }, [])

  const entries = specs ? Object.entries(specs) : blockPalette.map((b) => [b.type, { label: b.label } as any])

  return (
    <main className="neo-container">
      <div className="main-wrap">
        <h2>Blocks</h2>
        <div className="grid">
          {entries.map(([type, v]) => (
            <div key={type} className="neo-card">
              <div className="card-title">{(v as any)?.label || type}</div>
              <div className="muted"><code>{type}</code></div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

export default Blocks 