import { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import ReactFlow, { addEdge, Background, BackgroundVariant, Controls, Connection, Edge, Node, OnEdgesChange, OnNodesChange, applyNodeChanges, applyEdgeChanges } from 'reactflow'
import 'reactflow/dist/style.css'
import * as blocks from '../mocks/blocks.ts'
import { getMockLogsForIDE } from '../mocks/logs.ts'
import { useParams } from 'react-router-dom'
import { apiClient } from '../api/client'
import { useToast } from '../components/ToastProvider'
import { useModal } from '../context/ModalContext'

type BlockSpec = { type: string; summary?: string; input_schema?: any; output_schema?: any }

function typeToIcon(t: string): string {
  if (t.startsWith('http')) return '↗'
  if (t.startsWith('llm')) return '✦'
  if (t.startsWith('gcs')) return '▤'
  if (t.startsWith('json')) return '⤡'
  if (t.startsWith('transform')) return '✎'
  if (t.startsWith('math')) return '∑'
  if (t.startsWith('control')) return '◎'
  if (t === 'start') return '◎'
  return '■'
}

function IDE() {
  const { workflowId } = useParams()
  const { show } = useToast()
  const { open } = useModal()
  const [nodes, setNodes] = useState<Node[]>(blocks.defaultNodes)
  const [edges, setEdges] = useState<Edge[]>(blocks.defaultEdges)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [specs, setSpecs] = useState<BlockSpec[] | null>(null)
  const [query, setQuery] = useState<string>("")
  const consoleRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const loadSpecs = () => apiClient.getBlockSpecs().then((r) => setSpecs(r.blocks as unknown as BlockSpec[])).catch((e) => open({ title: 'Failed to load blocks', body: e?.message || 'Unknown error', primaryLabel: 'Retry', onPrimary: loadSpecs }))
    loadSpecs()
  }, [])

  useEffect(() => {
    if (workflowId && blocks.workflowGraphs[workflowId]) {
      const g = blocks.workflowGraphs[workflowId]
      setNodes(g.nodes)
      setEdges(g.edges)
    } else {
      setNodes(blocks.defaultNodes)
      setEdges(blocks.defaultEdges)
    }
  }, [workflowId])

  const onNodesChange = useCallback<OnNodesChange>((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), [])
  const onEdgesChange = useCallback<OnEdgesChange>((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), [])
  const onConnect = useCallback((connection: Connection) => setEdges((eds) => addEdge({ ...connection, animated: true }, eds)), [])

  const onSelectionChange = useCallback((params: { nodes: Node[]; edges: Edge[] }) => {
    const selected = params?.nodes
    setSelectedNode(selected && selected.length > 0 ? selected[0] : null)
  }, [])

  const consoleLines: string[] = useMemo(() => getMockLogsForIDE(), [])

  const handleAddBlock = useCallback((blockType: string) => {
    setNodes((prev) => [...prev, blocks.createNodeFromBlock(blockType, prev.length)])
  }, [])

  const handleRun = useCallback(async () => {
    if (!workflowId || !Number.isFinite(Number(workflowId))) return
    try {
      const resp = await apiClient.startRun(Number(workflowId), {})
      const line = `[RUN ${resp.id}] started`
      consoleRef.current && (consoleRef.current.innerHTML += `<div class="console-line">${line}</div>`)
      show('success', `Run ${resp.id} started`)
    } catch (e: any) {
      open({ title: 'Failed to start run', body: e?.message || 'Unknown error', primaryLabel: 'Close' })
    }
  }, [workflowId, show, open])

  const paletteItems = specs && specs.length > 0
    ? specs.map((s) => ({ type: s.type, label: s.type, summary: s.summary || '' }))
    : blocks.blockPalette.map((b) => ({ type: b.type, label: b.label, summary: '' }))

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return paletteItems
    return paletteItems.filter((b) =>
      b.type.toLowerCase().includes(q) ||
      b.label.toLowerCase().includes(q) ||
      (b.summary || '').toLowerCase().includes(q)
    )
  }, [paletteItems, query])

  return (
    <div className="page-ide" style={{padding: 0, margin: 0}}>
      <div className="nav-offset" />
      <div className="ide-layout">
        <aside className="ide-sidebar">
          <div className="sidebar-section">
            <div className="section-title">Blocks</div>
            <input
              type="text"
              className="neo-input"
              placeholder="Search blocks…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search blocks"
            />
            <div className="block-list">
              {filteredItems.map((b: { type: string; label: string; summary?: string }) => (
                <button key={b.type} className="neo-button block-item" onClick={() => handleAddBlock(b.type)}>
                  <span style={{marginRight:8}}>{typeToIcon(b.type)}</span>
                  <span>
                    <div style={{fontWeight:700}}>{b.label}</div>
                    {b.summary ? <div className="muted" style={{fontSize:11, lineHeight:1.2}}>{b.summary}</div> : null}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="ide-canvas">
          <div className="canvas-frame">
            <button className="neo-button run-button" onClick={handleRun}>Run</button>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onSelectionChange={onSelectionChange}
              fitView
            >
              <Controls position="bottom-right" />
              <Background variant={BackgroundVariant.Lines} gap={24} size={1} />
            </ReactFlow>
          </div>
        </section>

        <aside className="ide-inspector">
          <div className="sidebar-section">
            <div className="section-title">Inspector</div>
            {selectedNode ? (
              <div className="neo-card">
                <div><strong>ID:</strong> {selectedNode.id}</div>
                <div><strong>Label:</strong> {selectedNode.data?.label ?? '—'}</div>
                <div><strong>Type:</strong> {selectedNode.type ?? 'default'}</div>
                <div><strong>Position:</strong> {Math.round(selectedNode.position.x)}, {Math.round(selectedNode.position.y)}</div>
              </div>
            ) : (
              <div className="muted">Select a node to inspect</div>
            )}
          </div>
        </aside>

        <section className="ide-console" ref={consoleRef}>
          <div className="section-title">Console</div>
          <div className="console-lines">
            {consoleLines.map((l: string, i: number) => (
              <div key={i} className="console-line">{l}</div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default IDE 