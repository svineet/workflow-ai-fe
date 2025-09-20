import dagre from 'dagre'
import type { Edge, Node } from 'reactflow'

export function layoutGraph(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 60, marginx: 20, marginy: 20 })
  g.setDefaultEdgeLabel(() => ({}))

  nodes.forEach((n) => {
    // estimate node size; config nodes will be wider but layout will still be ok
    g.setNode(n.id, { width: 200, height: 80 })
  })
  edges.forEach((e) => {
    g.setEdge(e.source as string, e.target as string)
  })
  dagre.layout(g)

  const laidOut = nodes.map((n) => {
    const pos = g.node(n.id)
    if (!pos) return n
    return { ...n, position: { x: pos.x - pos.width / 2, y: pos.y - pos.height / 2 } }
  })

  return { nodes: laidOut, edges }
} 