import { MarkerType } from 'reactflow'
import type { Edge, Node } from 'reactflow'

export type BlockSpec = {
  type: string
  summary?: string
  settings_schema?: any
  input_schema?: any
  output_schema?: any
}

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
    const hasConfig = !!schema
    const node: Node = {
      id: n.id,
      type: hasConfig ? 'config' : undefined,
      data: { label: n.type, params: mergedSettings, schema: spec, typeName: n.type, onChangeParams },
      position: { x: (idx % 4) * 300, y: Math.floor(idx / 4) * 180 },
    }
    return node
  })

  const edges: Edge[] = (serverGraph?.edges || []).map((e: any) => ({
    id: e.id,
    source: e.from,
    target: e.to,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#000' },
    style: { stroke: '#000', strokeWidth: 2 },
  }))

  return { nodes, edges }
}

export function mapRFToServerGraph(nodes: Node[], edges: Edge[]): any {
  const sNodes = nodes.map((n) => {
    const typeName = (n as any)?.data?.typeName || (n as any)?.data?.label || 'unknown'
    const settings = (n as any)?.data?.params || {}
    return { id: n.id, type: String(typeName), settings }
  })
  const sEdges = edges.map((e, idx) => ({ id: e.id || `${e.source}-${e.target}-${idx}` as string, from: e.source as string, to: e.target as string }))
  return { nodes: sNodes, edges: sEdges }
} 