import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'

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
  return <input className="neo-input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
}

const ConfigNode = memo((props: NodeProps) => {
  const { id, data } = props as any
  const params = data?.params || {}
  const schema = data?.schema?.settings_schema || null
  const properties = schema?.properties || {}
  const required: string[] = schema?.required || []
  const isActive = !!data?.active

  const onChangeKey = (k: string, v: any) => {
    if (!data?.onChangeParams) return
    const next = { ...params, [k]: v }
    data.onChangeParams(id, next)
  }

  const keys = Object.keys(properties)
  keys.sort((a, b) => (required.includes(a) === required.includes(b)) ? a.localeCompare(b) : (required.includes(a) ? -1 : 1))

  return (
    <div className={`config-node${isActive ? ' active' : ''}`} style={{ padding: 8, background: '#fff', border: `3px solid ${isActive ? 'var(--accent)' : '#000'}` }}>
      <Handle type="target" position={Position.Left} />
      <div style={{ fontWeight: 800, marginBottom: 6 }}>{data?.label || data?.typeName}</div>
      <div style={{ borderTop: '3px solid #000', marginBottom: 8 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
        {keys.map((k) => (
          <div key={k}>
            {properties[k]?.type !== 'boolean' && <label style={{ fontSize: 12, fontWeight: 700 }}>{k}</label>}
            {renderField(k, properties[k], params[k], (v) => onChangeKey(k, v))}
          </div>
        ))}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
})

export default ConfigNode 