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
  // Separate nodes with and without positions
  const withPos: Node[] = []
  const needsLayout: Node[] = []
  nodes.forEach((n) => {
    if (n.position && typeof n.position.x === 'number' && typeof n.position.y === 'number') {
      withPos.push(n)
    } else {
      needsLayout.push(n)
    }
  })

  // If all nodes have positions, skip layout
  if (needsLayout.length === 0) {
    return { nodes, edges }
  }

  // Layout only nodes without positions
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'LR', nodesep: 180, ranksep: 220, marginx: 60, marginy: 60 })
  g.setDefaultEdgeLabel(() => ({}))

  needsLayout.forEach((n) => {
    const { width, height } = estimateNodeSize(n)
    g.setNode(n.id, { width, height })
  })
  edges.forEach((e) => {
    const kind = (e as any)?.data?.kind || 'control'
    if (kind === 'control') {
      // Only add edge if both nodes need layout
      if (needsLayout.some((n) => n.id === e.source) && needsLayout.some((n) => n.id === e.target)) {
        g.setEdge(e.source as string, e.target as string)
      }
    }
  })
  dagre.layout(g)

  const laidOut = needsLayout.map((n) => {
    const pos = g.node(n.id)
    if (!pos) return n
    return { ...n, position: { x: pos.x - pos.width / 2, y: pos.y - pos.height / 2 } }
  })

  // Merge positioned nodes with newly laid-out nodes
  return { nodes: [...withPos, ...laidOut], edges }
} 