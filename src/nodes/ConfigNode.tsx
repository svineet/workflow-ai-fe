import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import ReactMarkdown from 'react-markdown'

function toTypeSet(t: any): Set<string> {
  if (Array.isArray(t)) return new Set(t)
  if (typeof t === 'string') return new Set([t])
  return new Set()
}

function isJsonLike(schema: any, value: any): boolean {
  const tset = toTypeSet(schema?.type)
  if (tset.has('object') || tset.has('array')) return true
  if (schema?.properties || schema?.items) return true
  if (schema?.format === 'json' || schema?.contentMediaType === 'application/json') return true
  if (value && typeof value === 'object') return true
  return false
}

// Simple Jinja-like template renderer for Show nodes
function renderTemplate(template: string, context: Record<string, any>): string {
  if (!template || typeof template !== 'string') return ''
  
  try {
    // Replace {{ variable }} patterns with context values
    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, varPath) => {
      const keys = varPath.trim().split('.')
      let value = context
      
      for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
          value = value[key]
        } else {
          return match // Return original if path not found
        }
      }
      
      return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value || '')
    })
  } catch (e) {
    return `Template error: ${e}`
  }
}

function renderField(key: string, schema: any, value: any, onChange: (v: any) => void) {
  const tset = toTypeSet(schema?.type)
  const enumVals = schema?.enum as string[] | undefined
  if (enumVals && enumVals.length) {
    return (
      <select className="neo-input" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select…</option>
        {enumVals.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
      </select>
    )
  }
  if (tset.has('boolean')) {
    return (
      <label style={{display:'flex', alignItems:'center', gap:8}}>
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /> {key}
      </label>
    )
  }
  if (tset.has('number') || tset.has('integer')) {
    return <input className="neo-input" type="number" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />
  }
  if (isJsonLike(schema, value)) {
    const textValue = value == null ? '' : (typeof value === 'string' ? value : JSON.stringify(value, null, 2))
    return <textarea className="neo-input" rows={6} value={textValue} onChange={(e) => {
      const next = e.target.value
      try {
        const parsed = JSON.parse(next)
        onChange(parsed)
      } catch {
        onChange(next)
      }
    }} />
  }
  if (tset.has('string')) {
    return <textarea className="neo-input" rows={3} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
  }
  return <input className="neo-input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
}

const ConfigNode = memo((props: NodeProps) => {
  const { id, data } = props as any
  const params = data?.params || {}
  const schema = data?.schema?.settings_schema || null
  const properties = schema?.properties || {}
  const required: string[] = schema?.required || []
  const isActive = !!data?.active
  const isShowNode = data?.typeName === 'show'
  const runData = data?.runData
  const upstreamData = data?.upstreamData || {}

  const onChangeKey = (k: string, v: any) => {
    if (!data?.onChangeParams) return
    const next = { ...params, [k]: v }
    data.onChangeParams(id, next)
  }

  // For Show nodes, render markdown if we have runtime data and a template
  let showOutput = null
  if (isShowNode) {
    const backendRendered: string | undefined = runData?.outputs_json?.[id]?.data?.rendered || runData?.outputs_json?.[id]?.rendered
    if (backendRendered && typeof backendRendered === 'string') {
      showOutput = (
        <div className="show-node-output">
          <ReactMarkdown>{backendRendered}</ReactMarkdown>
        </div>
      )
    } else {
      const hasOutput = !!runData?.outputs_json?.[id]
      const template = params.template || params.content || ''
      if (hasOutput && template) {
        const context = {
          upstream: upstreamData,
          settings: params,
          output: runData.outputs_json[id],
          trigger: runData.trigger_payload_json || {}
        }
        const rendered = renderTemplate(template, context)
        if (rendered) {
          showOutput = (
            <div className="show-node-output">
              <ReactMarkdown>{rendered}</ReactMarkdown>
            </div>
          )
        } else {
          showOutput = (<div className="show-node-output muted">No output rendered.</div>)
        }
      } else {
        showOutput = (<div className="show-node-output muted">No output yet. Run the workflow to render.</div>)
      }
    }
  }

  const keys = Object.keys(properties)
  keys.sort((a, b) => (required.includes(a) === required.includes(b)) ? a.localeCompare(b) : (required.includes(a) ? -1 : 1))

  return (
    <div className={`config-node${isActive ? ' active' : ''}`} style={{ padding: 8, background: '#fff', border: `3px solid ${isActive ? 'var(--accent)' : '#000'}` }}>
      <Handle type="target" position={Position.Left} />
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: 6 }}>
        <div style={{ fontWeight: 800 }}>{data?.label || data?.typeName}</div>
        <span className="pill-muted" style={{ fontSize: 10, marginLeft: 4 }}>#{id}</span>
      </div>
      <div style={{ borderTop: '3px solid #000', marginBottom: 8 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
        {keys.map((k) => (
          <div key={k}>
            {properties[k]?.type !== 'boolean' && <label style={{ fontSize: 12, fontWeight: 700 }}>{k}</label>}
            {renderField(k, properties[k], params[k], (v) => onChangeKey(k, v))}
          </div>
        ))}
      </div>
      {showOutput}
      <Handle type="source" position={Position.Right} />
    </div>
  )
})

export default ConfigNode 