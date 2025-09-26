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
): { nodes: Node[]; edges: Edge[]; toolEdges: Edge[] } {
  const nodes: Node[] = (serverGraph?.nodes || []).map((n: any, idx: number) => {
    const spec = specMap[n.type] || {}
    const schema = extractSchema(spec)
    const defaults = extractDefaults(schema)
    const mergedSettings = { ...defaults, ...(n.settings || {}) }
    const hasToolsConnector = Array.isArray((spec as any)?.extras?.connectors) && (spec as any).extras.connectors.some((c: any) => c?.name === 'tools')
    const isAgent = spec?.kind === 'agent' || String(n.type || '').startsWith('agent.') || hasToolsConnector
    const isTool = String(n.type || '').startsWith('tool.') || !!(spec as any)?.extras?.toolCompatible
    const hasConfig = !!schema
    const node: Node = {
      id: n.id,
      type: isAgent ? 'agent' : (isTool ? 'tool' : (hasConfig ? 'config' : undefined)),
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

  // Rehydrate toolEdges from agent.settings.tools by matching tool types to existing nodes
  const toolEdges: Edge[] = []
  const idToNode: Record<string, Node> = Object.fromEntries(nodes.map((n) => [n.id, n]))
  const typeToNodes: Record<string, Node[]> = {}
  nodes.forEach((n) => {
    const t = (n as any)?.data?.typeName
    if (!typeToNodes[t]) typeToNodes[t] = []
    typeToNodes[t].push(n)
  })
  let newNodeIdx = nodes.length
  ;(serverGraph?.nodes || []).forEach((n: any) => {
    const spec = specMap[n.type] || {}
    if ((spec?.kind === 'agent' || String(n.type || '').startsWith('agent.') || (spec as any)?.extras?.connectors) && Array.isArray(n.settings?.tools)) {
      const agentId = n.id
      const toolsArr = n.settings.tools as ToolSpec[]
      toolsArr.forEach((t: ToolSpec, idx: number) => {
        let targetNode: Node | undefined
        const candidates = typeToNodes[t.type] || []
        targetNode = candidates.find((cn) => cn.id !== agentId)

        // Auto-create tool node if missing
        if (!targetNode) {
          const toolSpec = specMap[t.type] || {}
          const toolSchema = extractSchema(toolSpec)
          const toolDefaults = extractDefaults(toolSchema)
          const params = { ...toolDefaults, ...(t.settings || {}) }
          // place tool node below agent
          const agentNode = idToNode[agentId]
          const baseX = agentNode ? agentNode.position.x : (newNodeIdx % 4) * 300
          const baseY = agentNode ? agentNode.position.y : Math.floor(newNodeIdx / 4) * 180
          const created: Node = {
            id: `tool-${t.type}-${agentId}-${idx}-${newNodeIdx}`,
            type: 'tool',
            data: { label: t.type, params, schema: toolSpec, typeName: t.type, onChangeParams },
            position: { x: baseX, y: baseY + 140 },
          }
          nodes.push(created)
          if (!typeToNodes[t.type]) typeToNodes[t.type] = []
          typeToNodes[t.type].push(created)
          idToNode[created.id] = created
          targetNode = created
          newNodeIdx += 1
        }

        if (targetNode) {
          toolEdges.push({
            id: `tool-${agentId}-${targetNode.id}-${idx}`,
            source: agentId,
            target: targetNode.id,
            sourceHandle: 'tools',
            markerEnd: undefined,
            style: { stroke: '#000', strokeWidth: 2 },
            data: { toolEdge: true },
          } as Edge)
        }
      })
    }
  })

  return { nodes, edges, toolEdges }
}

export function computeAgentTools(nodes: Node[], toolEdges: Edge[]): Record<string, ToolSpec[]> {
  const out: Record<string, ToolSpec[]> = {}
  const idToNode: Record<string, Node> = Object.fromEntries(nodes.map((n) => [n.id, n]))
  const isToolNode = (n: Node) => String((n as any)?.data?.typeName || '').startsWith('tool.')
  const getDefaultName = (toolType: string) => (toolType.split('.').pop() || 'tool')

  toolEdges.forEach((e) => {
    const a = idToNode[e.source]
    const b = idToNode[e.target]
    const isAAgent = (a as any)?.data?.schema?.kind === 'agent' || e.sourceHandle === 'tools'
    const isBAgent = (b as any)?.data?.schema?.kind === 'agent' || e.targetHandle === 'tools'

    let agentNode: Node | null = null
    let toolNode: Node | null = null
    if (isAAgent && b && isToolNode(b)) { agentNode = a; toolNode = b }
    else if (isBAgent && a && isToolNode(a)) { agentNode = b; toolNode = a }
    else return

    const agentId = agentNode.id
    const toolType = String((toolNode as any)?.data?.typeName || '')
    const toolSettings = (toolNode as any)?.data?.params || {}
    const nameBase = getDefaultName(toolType)

    if (!out[agentId]) out[agentId] = []
    const existingNames = new Set(out[agentId].map((t) => t.name))
    let name = nameBase
    let counter = 2
    while (existingNames.has(name)) { name = `${nameBase}-${counter++}` }
    out[agentId].push({ name, type: toolType, settings: toolSettings })
  })

  return out
}

export function mapRFToServerGraph(nodes: Node[], edges: Edge[], agentTools?: Record<string, ToolSpec[]>): any {
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
  const sNodes = nodes
    // Exclude tool-only nodes from persistence
    .filter((n) => {
      const explicitToolType = (n as any)?.type === 'tool'
      const tn = String((n as any)?.data?.typeName || '')
      const toolByPrefix = tn.startsWith('tool.')
      const extrasTool = !!((n as any)?.data?.schema?.extras?.toolCompatible)
      return !(explicitToolType || toolByPrefix || extrasTool)
    })
    .map((n) => {
      const typeName = (n as any)?.data?.typeName || (n as any)?.data?.label || 'unknown'
      const settings = (n as any)?.data?.params || {}
      const id = n.id
      const finalSettings: Record<string, any> = {}
      Object.keys(settings).forEach((k) => { finalSettings[k] = coerceJsonish((settings as any)[k]) })
      if (agentTools && agentTools[id]) {
        finalSettings.tools = agentTools[id]
      }
      return { id, type: String(typeName), settings: finalSettings }
    })
  const sEdges = edges.map((e, idx) => ({ id: e.id || `${e.source}-${e.target}-${idx}` as string, from: e.source as string, to: e.target as string }))
  return { nodes: sNodes, edges: sEdges }
} 