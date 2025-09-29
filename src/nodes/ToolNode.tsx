import { memo, useMemo, useState } from 'react'
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

function isMultiline(schema: any): boolean {
  const fmt = (schema?.format || '').toLowerCase()
  const widget = (schema?.['ui_widget'] || schema?.['x-ui-widget'] || '').toLowerCase()
  const uiMultiline = !!(schema?.['ui_multiline'] || schema?.['x-ui-multiline'])
  const media = (schema?.contentMediaType || '').toLowerCase()
  const maxLen = typeof schema?.maxLength === 'number' ? schema.maxLength : undefined
  return uiMultiline || widget === 'textarea' || fmt === 'multiline' || fmt === 'textarea' || media === 'text/markdown' || (typeof maxLen === 'number' && maxLen > 200)
}

function isUIRequired(propSchema: any, key: string, requiredList: string[]): boolean {
  return requiredList.includes(key) || !!(propSchema?.['ui_required'] || propSchema?.['uiRequired'] || propSchema?.['x-ui-required'])
}

function normalizeJsonInput(rawText: string): any {
  if (typeof rawText !== 'string') return rawText
  let s = rawText.trim()
  if ((s.startsWith("r'") && s.endsWith("'")) || (s.startsWith('r"') && s.endsWith('"'))) {
    s = s.slice(2, -1)
  } else if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
    s = s.slice(1, -1)
  }
  try { return JSON.parse(s) } catch {}
  try { return JSON.parse(rawText) } catch {}
  return rawText
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
      const normalized = normalizeJsonInput(next)
      if (typeof normalized === 'string') onChange(next)
      else onChange(normalized)
    }} />
  }
  if (tset.has('string')) {
    if (isMultiline(schema)) {
      return <textarea className="neo-input" rows={3} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    }
    return <input className="neo-input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
  }
  return <input className="neo-input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
}

const ToolNode = memo((props: NodeProps) => {
  const { id, data } = props as any
  const isActive = !!data?.active
  const connectedAgents: string[] = Array.isArray(data?.connectedAgents) ? data.connectedAgents : []
  const summary: string = (data?.schema?.summary as string) || ''
  const params = data?.params || {}
  const schema = data?.schema?.settings_schema || null
  const properties: Record<string, any> = (schema?.properties || {})
  const required: string[] = schema?.required || []
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(false)

  const { requiredKeys, optionalKeys } = useMemo(() => {
    const keys = Object.keys(properties)
    keys.sort((a, b) => (isUIRequired(properties[a], a, required) === isUIRequired(properties[b], b, required)) ? a.localeCompare(b) : (isUIRequired(properties[a], a, required) ? -1 : 1))
    return {
      requiredKeys: keys.filter((k) => required.includes(k)),
      optionalKeys: keys.filter((k) => !required.includes(k)),
    }
  }, [properties, required])

  const onChangeKey = (k: string, v: any) => {
    if (!data?.onChangeParams) return
    const next = { ...params, [k]: v }
    data.onChangeParams(id, next)
  }

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

      {/* Configurable settings for the tool */}
      {requiredKeys.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6, marginTop: 8 }}>
          {requiredKeys.map((k) => (
            <div key={k}>
              {properties[k]?.type !== 'boolean' && <label style={{ fontSize: 12, fontWeight: 700 }}>{k}</label>}
              {renderField(k, properties[k], params[k], (v) => onChangeKey(k, v))}
            </div>
          ))}
        </div>
      )}

      {optionalKeys.length > 0 && (
        <div className="advanced-toggle" onClick={(e) => { e.stopPropagation(); setAdvancedOpen((v) => !v) }}>
          <span>Advanced</span>
          <span style={{display:'inline-flex', marginLeft: 6}}>{advancedOpen ? '▴' : '▾'}</span>
        </div>
      )}

      {advancedOpen && optionalKeys.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6, marginTop: 8 }}>
          {optionalKeys.map((k) => (
            <div key={k}>
              {properties[k]?.type !== 'boolean' && <label style={{ fontSize: 12, fontWeight: 700 }}>{k}</label>}
              {renderField(k, properties[k], params[k], (v) => onChangeKey(k, v))}
            </div>
          ))}
        </div>
      )}

      {/* Single connector (target) to connect from Agent's Tools handle */}
      <div style={{ marginTop: 8, fontSize: 12, fontWeight: 800, textAlign: 'center' }}>Agent Link</div>
      <Handle id="tool" type="target" position={Position.Top} style={{ left: '50%', transform: 'translateX(-50%)', background: '#3b82f6' }} />
    </div>
  )
})

export default ToolNode 