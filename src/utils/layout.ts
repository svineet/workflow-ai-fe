import dagre from 'dagre'
import type { Edge, Node } from 'reactflow'

function estimateNodeSize(n: Node): { width: number; height: number } {
  const isConfig = n.type === 'config'
  if (!isConfig) return { width: 260, height: 120 }
  const props = (n as any)?.data?.schema?.settings_schema?.properties || {}
  const fields = Math.max(1, Object.keys(props).length)
  const width = 360
  const height = Math.min(640, Math.max(160, 100 + fields * 32))
  return { width, height }
}

export function layoutGraph(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'LR', nodesep: 180, ranksep: 220, marginx: 60, marginy: 60 })
  g.setDefaultEdgeLabel(() => ({}))

  nodes.forEach((n) => {
    const { width, height } = estimateNodeSize(n)
    g.setNode(n.id, { width, height })
  })
  edges.forEach((e) => {
    const kind = (e as any)?.data?.kind || 'control'
    if (kind === 'control') {
      g.setEdge(e.source as string, e.target as string)
    }
  })
  dagre.layout(g)

  const laidOut = nodes.map((n) => {
    const pos = g.node(n.id)
    if (!pos) return n
    return { ...n, position: { x: pos.x - pos.width / 2, y: pos.y - pos.height / 2 } }
  })

  return { nodes: laidOut, edges }
} 