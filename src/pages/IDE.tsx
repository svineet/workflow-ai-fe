import { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import ReactFlow, { addEdge, Background, BackgroundVariant, Controls, Connection, Edge, Node, OnEdgesChange, OnNodesChange, applyNodeChanges, applyEdgeChanges, useReactFlow } from 'reactflow'
import 'reactflow/dist/style.css'
import * as blocks from '../mocks/blocks.ts'
import { getMockLogsForIDE } from '../mocks/logs.ts'
import { useParams } from 'react-router-dom'
import { apiClient } from '../api/client'
import { FaCog, FaChevronDown, FaChevronUp } from 'react-icons/fa'
import { useModal } from '../context/ModalContext'
import ConfigNode from '../nodes/ConfigNode'
import { layoutGraph } from '../utils/layout'
import { mapServerGraphToRF, specsToMap } from '../utils/graphMapper'

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

type BlockSpec = { type: string; summary?: string; settings_schema?: any; input_schema?: any; output_schema?: any }

function extractSchema(spec: any) {
  return spec?.settings_schema || spec?.config_schema || spec?.input_schema || null
}

function extractDefaults(schema: any): Record<string, any> {
  const props = schema?.properties || {}
  const entries = Object.keys(props).map((k) => [k, (props[k] && props[k].default !== undefined) ? props[k].default : undefined])
  return Object.fromEntries(entries)
}

function IDE() {
  const { workflowId } = useParams()
  const { open } = useModal()
  const [nodes, setNodes] = useState<Node[]>(blocks.defaultNodes)
  const [edges, setEdges] = useState<Edge[]>(blocks.defaultEdges)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [specs, setSpecs] = useState<BlockSpec[] | null>(null)
  const [query, setQuery] = useState<string>("")
  const [toolboxOpen, setToolboxOpen] = useState<boolean>(false)
  const consoleRef = useRef<HTMLDivElement | null>(null)
  const consoleLines: string[] = useMemo(() => getMockLogsForIDE(), [])
  const [consoleOpen, setConsoleOpen] = useState<boolean>(true)

  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedNodeId) || null, [nodes, selectedNodeId])

  useEffect(() => {
    const load = async () => {
      try {
        const idNum = Number(workflowId)
        const [specsResp, wf] = await Promise.all([
          apiClient.getBlockSpecs(),
          Number.isFinite(idNum) ? apiClient.getWorkflow(idNum) : Promise.resolve(null as any)
        ])
        const specMap = specsToMap((specsResp.blocks as unknown as any[]) || [])

        if (wf && wf.graph) {
          const { nodes: rawNodes, edges: rawEdges } = mapServerGraphToRF(wf.graph, specMap, (nodeId, nextParams) => {
            setNodes((prev) => prev.map((pn) => pn.id === nodeId ? { ...pn, data: { ...pn.data, params: nextParams } } : pn))
          })
          const laid = layoutGraph(rawNodes.map((n) => ({ ...n, position: { x: n.position.x, y: n.position.y } })), rawEdges)
          setNodes(laid.nodes)
          setEdges(laid.edges)
        } else {
          const laid = layoutGraph(blocks.defaultNodes as any, blocks.defaultEdges as any)
          setNodes(laid.nodes)
          setEdges(laid.edges)
        }
        setSpecs((specsResp.blocks as unknown as any[]) || [])
      } catch (e: any) {
        open({ title: 'Failed to load workflow', body: e?.message || 'Unknown error', primaryLabel: 'Close' })
      }
    }
    load()
  }, [workflowId, open])

  const onNodesChange = useCallback<OnNodesChange>((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), [])
  const onEdgesChange = useCallback<OnEdgesChange>((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), [])
  const onConnect = useCallback((connection: Connection) => setEdges((eds) => addEdge({ ...connection, animated: true }, eds)), [])

  const onSelectionChange = useCallback((params: { nodes: Node[]; edges: Edge[] }) => {
    const sel = params?.nodes && params.nodes[0]
    setSelectedNodeId(sel ? sel.id : null)
  }, [])

  const nodeTypes = useMemo(() => ({ config: ConfigNode }), [])

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

  const handleAddBlock = useCallback((blockType: string) => {
    setNodes((prev) => {
      const spec = (specs || []).find((s: any) => s.type === blockType) as any
      const schema = extractSchema(spec)
      const defaults = extractDefaults(schema)
      const hasConfig = !!schema
      const id = `n-${blockType}-${Date.now()}`
      const newNode: Node = {
        id,
        type: hasConfig ? 'config' : undefined,
        data: { label: blockType, params: { ...defaults }, schema: spec, typeName: blockType, onChangeParams: (nodeId: string, nextParams: any) => {
          setNodes((pp) => pp.map((pn) => pn.id === nodeId ? { ...pn, data: { ...pn.data, params: nextParams } } : pn))
        } },
        position: { x: 80, y: 80 + prev.length * 40 },
      }
      const laid = layoutGraph([...prev, newNode], edges)
      setEdges(laid.edges)
      return laid.nodes
    })
  }, [edges, specs])

  const handleRun = useCallback(async () => {
    if (!workflowId || !Number.isFinite(Number(workflowId))) return
    try {
      const resp = await apiClient.startRun(Number(workflowId), {})
      const line = `[RUN ${resp.id}] started`
      consoleRef.current && (consoleRef.current.innerHTML += `<div class=\"console-line\">${line}</div>`)
    } catch (e: any) {
      open({ title: 'Failed to start run', body: e?.message || 'Unknown error', primaryLabel: 'Close' })
    }
  }, [workflowId, open])

  return (
    <div className="page-ide" style={{padding: 0, margin: 0}}>
      <div className="nav-offset" />
      <div className={`ide-layout no-sidebar`}>
        <section className="ide-canvas">
          <div className="canvas-frame">
            <button className="neo-button run-button" onClick={handleRun}>Run</button>
            <button className="neo-button toolbox-toggle" onClick={() => setToolboxOpen((v) => !v)}><FaCog size={16} /></button>
            {toolboxOpen && (
              <div className="toolbox-panel">
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
            )}
            <ReactFlow
              nodeTypes={nodeTypes}
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onSelectionChange={onSelectionChange}
              fitView
              minZoom={0.2}
              defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
              defaultEdgeOptions={{ animated: false, style: { stroke: '#000', strokeWidth: 2 }, markerEnd: { type: 'arrowclosed' as any, color: '#000' } }}
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
                {selectedNode.data?.schema && (
                  <div style={{marginTop:8}}>
                    <div style={{ fontWeight: 900, marginBottom: 6, borderBottom: '3px solid #000', paddingBottom: 4 }}>Properties</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 4, fontSize: 12 }}>
                      {Object.keys((selectedNode.data.schema.settings_schema?.properties || selectedNode.data.schema.config_schema?.properties || selectedNode.data.schema.input_schema?.properties) || {}).map((k) => {
                        const def = (selectedNode.data.schema.settings_schema?.properties?.[k]?.default
                          ?? selectedNode.data.schema.config_schema?.properties?.[k]?.default
                          ?? selectedNode.data.schema.input_schema?.properties?.[k]?.default)
                        const val = (selectedNode.data?.params?.[k] === undefined || selectedNode.data?.params?.[k] === null || selectedNode.data?.params?.[k] === '') ? def : selectedNode.data?.params?.[k]
                        const str = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '')
                        return (
                          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                            <span style={{ fontWeight: 900 }}>{k}</span>
                            <code style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12 }}>{str}</code>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="muted">Select a node to inspect</div>
            )}
          </div>
        </aside>

        <section className={`ide-console ${consoleOpen ? 'expanded' : 'collapsed'}`} ref={consoleRef}>
          <div className="console-header">
            <button className="neo-button toggle" onClick={() => setConsoleOpen((v) => !v)}>{consoleOpen ? <FaChevronDown /> : <FaChevronUp />}</button>
            <div className="section-title" style={{margin:0}}>Console</div>
          </div>
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