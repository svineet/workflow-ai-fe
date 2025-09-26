import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'

const ToolNode = memo((props: NodeProps) => {
  const { id, data } = props as any
  const isActive = !!data?.active
  const connectedAgents: string[] = Array.isArray(data?.connectedAgents) ? data.connectedAgents : []
  const summary: string = (data?.schema?.summary as string) || ''

  return (
    <div className={`config-node${isActive ? ' active' : ''}`} style={{ padding: 8, background: '#fff', border: `3px solid ${isActive ? 'var(--accent)' : '#000'}` }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: 6 }}>
        <div style={{ fontWeight: 800 }}>{data?.label || data?.typeName || 'tool'}</div>
        <span className="pill-muted" style={{ fontSize: 10, marginLeft: 4 }}>#{id}</span>
      </div>
      <div style={{ borderTop: '3px solid #000', marginBottom: 8 }} />

      <div style={{ fontSize: 12 }}>
        {summary ? <div className="muted" style={{ marginBottom: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{summary}</div> : null}
        <div className="muted">Tool-compatible</div>
        {connectedAgents.length > 0 && (
          <div style={{ marginTop: 6 }}>
            <strong style={{ fontSize: 12 }}>Used by agents:</strong>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:4 }}>
              {connectedAgents.map((aid) => (
                <span key={aid} className="pill-muted" style={{ fontSize: 10 }}>#{aid}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Single connector (target) to connect from Agent's Tools handle */}
      <div style={{ marginTop: 8, fontSize: 12, fontWeight: 800, textAlign: 'center' }}>Agent Link</div>
      <Handle id="tool" type="target" position={Position.Top} style={{ left: '50%', transform: 'translateX(-50%)', background: '#3b82f6' }} />
    </div>
  )
})

export default ToolNode 