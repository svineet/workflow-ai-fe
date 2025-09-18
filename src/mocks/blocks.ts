import { Edge, Node, Position } from 'reactflow'

export type BlockPaletteItem = {
  type: string
  label: string
  icon: string
}

export const blockPalette: BlockPaletteItem[] = [
  { type: 'start', label: 'Start', icon: '◎' },
  { type: 'http', label: 'HTTP Request', icon: '↗' },
  { type: 'llm', label: 'LLM', icon: '✦' },
  { type: 'gcs', label: 'GCS Write', icon: '▤' },
]

export const defaultNodes: Node[] = [
  { id: 'n-start', type: 'input', position: { x: 50, y: 50 }, data: { label: 'Start' }, sourcePosition: Position.Right },
  { id: 'n-http', position: { x: 280, y: 50 }, data: { label: 'HTTP' } },
  { id: 'n-llm', position: { x: 520, y: 50 }, data: { label: 'LLM' } },
]

export const defaultEdges: Edge[] = [
  { id: 'e-1', source: 'n-start', target: 'n-http', animated: true },
  { id: 'e-2', source: 'n-http', target: 'n-llm', animated: true },
]

export const workflowGraphs: Record<string, { nodes: Node[]; edges: Edge[] }> = {
  'wf-hello-world': {
    nodes: [
      { id: 'hw-start', type: 'input', position: { x: 40, y: 60 }, data: { label: 'Start' }, sourcePosition: Position.Right },
      { id: 'hw-llm', position: { x: 260, y: 60 }, data: { label: 'LLM: Hello' } },
    ],
    edges: [
      { id: 'hw-e1', source: 'hw-start', target: 'hw-llm', animated: true },
    ],
  },
  'wf-http-to-llm': {
    nodes: [
      { id: 'h2l-start', type: 'input', position: { x: 40, y: 60 }, data: { label: 'Start' }, sourcePosition: Position.Right },
      { id: 'h2l-http', position: { x: 260, y: 40 }, data: { label: 'HTTP GET' } },
      { id: 'h2l-llm', position: { x: 480, y: 60 }, data: { label: 'LLM: Summarize' } },
    ],
    edges: [
      { id: 'h2l-e1', source: 'h2l-start', target: 'h2l-http', animated: true },
      { id: 'h2l-e2', source: 'h2l-http', target: 'h2l-llm', animated: true },
    ],
  },
}

export function createNodeFromBlock(blockType: string, index: number): Node {
  const baseX = 100 + (index % 4) * 180
  const baseY = 180 + Math.floor(index / 4) * 120
  const label = blockPalette.find((b) => b.type === blockType)?.label ?? blockType
  const id = `n-${blockType}-${Date.now()}-${index}`
  switch (blockType) {
    case 'start':
      return { id, type: 'input', position: { x: baseX, y: baseY }, data: { label }, sourcePosition: Position.Right }
    case 'http':
    case 'llm':
    case 'gcs':
    default:
      return { id, position: { x: baseX, y: baseY }, data: { label } }
  }
} 