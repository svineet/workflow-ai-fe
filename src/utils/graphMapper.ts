import { MarkerType } from 'reactflow'
import type { Edge, Node } from 'reactflow'

export type BlockSpec = {
  type: string
  summary?: string
  settings_schema?: any
  input_schema?: any
  output_schema?: any
  kind?: string
  extras?: any
}

export type ToolSpec = { name: string; type: string; settings: any }

function extractSchema(spec: any) {
  return spec?.settings_schema || spec?.config_schema || spec?.input_schema || null
}

function extractDefaults(schema: any): Record<string, any> {
  const props = schema?.properties || {}
  const out: Record<string, any> = {}
  Object.keys(props).forEach((k) => {
    if (Object.prototype.hasOwnProperty.call(props[k], 'default')) out[k] = props[k].default
  })
  return out
}

export function specsToMap(specs: BlockSpec[] | null | undefined): Record<string, BlockSpec> {
  const m: Record<string, BlockSpec> = {}
  ;(specs || []).forEach((s) => { m[s.type] = s })
  return m
}

export function mapServerGraphToRF(
  serverGraph: any,
  specMap: Record<string, BlockSpec>,
  onChangeParams: (nodeId: string, nextParams: any) => void,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = (serverGraph?.nodes || []).map((n: any, idx: number) => {
    const spec = specMap[n.type] || {}
    const schema = extractSchema(spec)
    const defaults = extractDefaults(schema)
    const mergedSettings = { ...defaults, ...(n.settings || {}) }
    const hasToolsConnector = Array.isArray((spec as any)?.extras?.connectors) && (spec as any).extras.connectors.some((c: any) => c?.name === 'tools')
    const isAgent = spec?.kind === 'agent' || String(n.type || '').startsWith('agent.') || hasToolsConnector
    const isTool = String(n.type || '').startsWith('tool.') || !!(spec as any)?.extras?.toolCompatible
    const hasConfig = !!schema
    const pos = (n as any)?.position
    const node: Node = {
      id: n.id,
      type: isAgent ? 'agent' : (isTool ? 'tool' : (hasConfig ? 'config' : undefined)),
      data: { label: n.type, params: mergedSettings, schema: spec, typeName: n.type, onChangeParams },
      position: (pos && typeof pos.x === 'number' && typeof pos.y === 'number')
        ? { x: pos.x, y: pos.y }
        : { x: (idx % 4) * 300, y: Math.floor(idx / 4) * 180 },
    }
    return node
  })

  const edges: Edge[] = (serverGraph?.edges || []).map((e: any, idx: number) => {
    const kind = e.kind || 'control'
    const isTool = kind === 'tool'
    const edge: Edge = {
      id: e.id || `${e.from}-${e.to}-${idx}`,
      type: 'smoothstep',
      source: e.from,
      target: e.to,
      data: { kind },
      style: isTool ? { stroke: '#000', strokeWidth: 2 } : { stroke: '#000', strokeWidth: 2 },
      markerEnd: isTool ? undefined : { type: MarkerType.ArrowClosed, color: '#000' },
    } as Edge
    if (isTool) {
      (edge as any).sourceHandle = 'tools'
      ;(edge as any).targetHandle = 'tool'
    }
    return edge
  })

  return { nodes, edges }
}

export function computeAgentToolsFromEdges(nodes: Node[], edges: Edge[]): Record<string, ToolSpec[]> {
  const out: Record<string, ToolSpec[]> = {}
  const idToNode: Record<string, Node> = Object.fromEntries(nodes.map((n) => [n.id, n]))

  edges.forEach((e) => {
    if ((e as any)?.data?.kind !== 'tool') return
    const agent = idToNode[e.source]
    const tool = idToNode[e.target]
    if (!agent || !tool) return
    const toolType = String((tool as any)?.data?.typeName || '')
    const toolSettings = (tool as any)?.data?.params || {}
    const nameBase = (toolType.split('.').pop() || 'tool')
    if (!out[agent.id]) out[agent.id] = []
    const existingNames = new Set(out[agent.id].map((t) => t.name))
    let name = nameBase
    let counter = 2
    while (existingNames.has(name)) { name = `${nameBase}-${counter++}` }
    out[agent.id].push({ name, type: toolType, settings: toolSettings })
  })

  return out
}

export function mapRFToServerGraph(nodes: Node[], edges: Edge[]): any {
  const coerceJsonish = (v: any): any => {
    if (typeof v === 'string') {
      const s = v.trim()
      const looks = (s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))
      if (looks) {
        try { return JSON.parse(s) } catch {}
      }
    }
    return v
  }

  const sNodes = nodes.map((n) => {
    const typeName = (n as any)?.data?.typeName || (n as any)?.data?.label || 'unknown'
    const settings = (n as any)?.data?.params || {}
    const id = n.id
    const finalSettings: Record<string, any> = {}
    Object.keys(settings).forEach((k) => { finalSettings[k] = coerceJsonish((settings as any)[k]) })
    const position = (n as any)?.position && typeof (n as any).position.x === 'number' && typeof (n as any).position.y === 'number'
      ? { x: (n as any).position.x, y: (n as any).position.y }
      : undefined
    return { id, type: String(typeName), settings: finalSettings, ...(position ? { position } : {}) }
  })

  const sEdges = edges.map((e, idx) => ({
    id: e.id || `${e.source}-${e.target}-${idx}` as string,
    from: e.source as string,
    to: e.target as string,
    kind: ((e as any)?.data?.kind || 'control') as 'control' | 'tool',
  }))

  return { nodes: sNodes, edges: sEdges }
} 