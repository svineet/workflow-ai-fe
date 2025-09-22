import { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import ReactFlow, { addEdge, Background, BackgroundVariant, Controls, Connection, Edge, Node, OnEdgesChange, OnNodesChange, applyNodeChanges, applyEdgeChanges, MarkerType } from 'reactflow'
import type { ReactFlowInstance } from 'reactflow'
import 'reactflow/dist/style.css'
import * as blocks from '../mocks/blocks.ts'
import { getMockLogsForIDE } from '../mocks/logs.ts'
import { useParams } from 'react-router-dom'
import { apiClient } from '../api/client'
import { API_BASE_URL } from '../api/config'
import type { LogEntry } from '../api/types'
import { FaCog, FaChevronDown, FaChevronUp, FaChevronLeft, FaChevronRight } from 'react-icons/fa'
import { useModal } from '../context/ModalContext'
import ConfigNode from '../nodes/ConfigNode'
import { layoutGraph } from '../utils/layout'
import { mapServerGraphToRF, specsToMap, mapRFToServerGraph } from '../utils/graphMapper'

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
  const rfRef = useRef<ReactFlowInstance | null>(null)
  const [nodes, setNodes] = useState<Node[]>(blocks.defaultNodes)
  const [edges, setEdges] = useState<Edge[]>(blocks.defaultEdges)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [specs, setSpecs] = useState<BlockSpec[] | null>(null)
  const [query, setQuery] = useState<string>("")
  const [toolboxOpen, setToolboxOpen] = useState<boolean>(false)
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(true)
  const consoleRef = useRef<HTMLDivElement | null>(null)
  const [consoleOpen, setConsoleOpen] = useState<boolean>(true)
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const saveTimerRef = useRef<any>(null)
  const lastSavedGraphRef = useRef<string>('')
  const [connMode, setConnMode] = useState<'idle' | 'sse' | 'polling'>('idle')

  // Live run streaming state
  const [currentRunId, setCurrentRunId] = useState<number | null>(null)
  const [liveLogs, setLiveLogs] = useState<string[]>([])
  const [activeNodeIds, setActiveNodeIds] = useState<Set<string>>(new Set())
  const lastLogIdRef = useRef<number>(0)
  const statusRef = useRef<string>('')
  const pollTimersRef = useRef<{ logs: any | null; status: any | null }>({ logs: null, status: null })
  const esRef = useRef<EventSource | null>(null)

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

  useEffect(() => {
    const t = setTimeout(() => {
      try { rfRef.current?.fitView({ padding: 0.2 }) } catch {}
    }, 0)
    return () => clearTimeout(t)
  }, [nodes.length, edges.length])

  useEffect(() => {
    if (!consoleRef.current) return
    consoleRef.current.scrollTop = consoleRef.current.scrollHeight
  }, [liveLogs.length])

  useEffect(() => {
    setNodes((prev) => prev.map((n) => ({ ...n, data: { ...n.data, active: activeNodeIds.has(n.id) } })))
  }, [activeNodeIds])

  const onNodesChange = useCallback<OnNodesChange>((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), [])
  const onEdgesChange = useCallback<OnEdgesChange>((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), [])
  const onConnect = useCallback((connection: Connection) => setEdges((eds) => addEdge(connection, eds)), [])

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

  const appendLogLines = useCallback((entries: LogEntry[]) => {
    if (!entries || entries.length === 0) return
    const newLines: string[] = []
    let maxId = lastLogIdRef.current
    for (const e of entries) {
      if (e.id <= lastLogIdRef.current) continue
      maxId = Math.max(maxId, e.id)
      const line = `${e.ts} [${e.level}]${e.node_id ? ` (${e.node_id})` : ''} ${e.message}`
      newLines.push(line)
    }
    if (newLines.length) setLiveLogs((prev) => [...prev, ...newLines])
    lastLogIdRef.current = maxId
  }, [])

  const appendErrorLine = useCallback((text: string) => {
    const ts = new Date().toISOString()
    const line = `${ts} [error] ${text}`
    setLiveLogs((prev) => [...prev, line])
  }, [])

  const appendInfoLine = useCallback((text: string) => {
    const ts = new Date().toISOString()
    const line = `${ts} [info] ${text}`
    setLiveLogs((prev) => [...prev, line])
  }, [])

  const stopStreaming = useCallback(() => {
    if (esRef.current) { try { esRef.current.close() } catch {} esRef.current = null }
    if (pollTimersRef.current.logs) { clearInterval(pollTimersRef.current.logs); pollTimersRef.current.logs = null }
    if (pollTimersRef.current.status) { clearInterval(pollTimersRef.current.status); pollTimersRef.current.status = null }
    setConnMode('idle')
    setActiveNodeIds(new Set()) // Clear highlights when streaming stops
  }, [])

  const startPolling = useCallback((runId: number) => {
    stopStreaming()
    setConnMode('polling')
    appendInfoLine('Switched to polling')
    pollTimersRef.current.logs = setInterval(async () => {
      try {
        const logs = await apiClient.getRunLogs(runId)
        appendLogLines(logs)
      } catch (e: any) {
        console.error('Polling logs error', e)
        appendErrorLine('Polling logs error')
      }
    }, 1500)
    pollTimersRef.current.status = setInterval(async () => {
      try {
        const run = await apiClient.getRun(runId)
        statusRef.current = run.status
        appendInfoLine(`Run status: ${run.status}`)
        if (run.status === 'succeeded' || run.status === 'failed') {
          stopStreaming()
        }
      } catch (e: any) {
        console.error('Polling status error', e)
        appendErrorLine('Polling status error')
      }
    }, 2500)
  }, [appendLogLines, stopStreaming, appendErrorLine, appendInfoLine])

  const startSSE = useCallback((runId: number) => {
    stopStreaming()
    try {
      const es = new EventSource(`${API_BASE_URL}/runs/${runId}/stream`)
      esRef.current = es
      es.onopen = () => { setConnMode('sse'); console.log('SSE open'); appendInfoLine('SSE connected') }
      es.onmessage = (ev) => {
        console.log('SSE message', ev?.data)
        try {
          const data = JSON.parse(ev.data)
          if (Array.isArray(data)) {
            appendLogLines(data as LogEntry[])
          } else if (data?.type === 'log' && data?.entry) {
            appendLogLines([data.entry as LogEntry])
          } else if (data?.type === 'node_started' && data?.node_id) {
            setActiveNodeIds(new Set([data.node_id]))
          } else if ((data?.type === 'node_finished' || data?.type === 'node_failed') && data?.node_id) {
            setActiveNodeIds((prev) => { const s = new Set(prev); s.delete(data.node_id); return s })
          } else if (data?.type === 'status') {
            statusRef.current = data.status
            appendInfoLine(`Run status: ${data.status}`)
            if (data.status === 'succeeded' || data.status === 'failed') {
              setActiveNodeIds(new Set()) // Clear highlights on completion
              stopStreaming()
            }
          }
        } catch (err: any) {
          console.error('SSE onmessage parse error', err, ev?.data)
          appendErrorLine('SSE message parse error')
        }
      }
      es.onerror = (ev) => {
        console.error('SSE error', ev)
        appendErrorLine('SSE connection error; switching to polling')
        try { es.close() } catch {}
        startPolling(runId)
      }
    } catch (e: any) {
      console.error('SSE init error', e)
      appendErrorLine('SSE init error; switching to polling')
      startPolling(runId)
    }
  }, [appendLogLines, startPolling, stopStreaming, appendErrorLine, appendInfoLine])

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

  // Debounced save when nodes/edges or params change
  useEffect(() => {
    if (!workflowId || !Number.isFinite(Number(workflowId))) return
    const graph = mapRFToServerGraph(nodes, edges)
    const serialized = JSON.stringify(graph)
    if (serialized === lastSavedGraphRef.current) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setSavingState('saving')
    saveTimerRef.current = setTimeout(async () => {
      try {
        await apiClient.updateWorkflow(Number(workflowId), { graph })
        lastSavedGraphRef.current = serialized
        setSavingState('saved')
        setTimeout(() => setSavingState('idle'), 1000)
      } catch (e) {
        setSavingState('error')
      }
    }, 600)
  }, [nodes, edges, workflowId])

  const handleRun = useCallback(async () => {
    if (!workflowId || !Number.isFinite(Number(workflowId))) return
    try {
      setLiveLogs([])
      setActiveNodeIds(new Set())
      lastLogIdRef.current = 0
      const resp = await apiClient.startRun(Number(workflowId), {})
      setCurrentRunId(resp.id)
      appendInfoLine(`RUN ${resp.id} started`)
      // quick initial fetch to populate console immediately
      try {
        const firstLogs = await apiClient.getRunLogs(resp.id)
        appendLogLines(firstLogs)
      } catch (e: any) {
        console.error('Initial logs fetch error', e)
      }
      // start streaming
      startSSE(resp.id)
    } catch (e: any) {
      open({ title: 'Failed to start run', body: e?.message || 'Unknown error', primaryLabel: 'Close' })
    }
  }, [workflowId, open, startSSE, appendInfoLine, appendLogLines])

  return (
    <div className="page-ide" style={{padding: 0, margin: 0}}>
      <div className="nav-offset" />
      <div className={`ide-layout ${inspectorOpen ? 'inspector-open' : ''}`}>
        <section className="ide-canvas">
          <div className="canvas-frame">
            <button className="neo-button toolbox-toggle" onClick={() => setToolboxOpen((v) => !v)}><FaCog size={16} /></button>
            <div className="ide-actions">
              <button className="neo-button run-button" onClick={handleRun}>Run</button>
              <button className="neo-button inspector-toggle" onClick={() => setInspectorOpen((v) => !v)}>
                {inspectorOpen ? <FaChevronRight size={16} /> : <FaChevronLeft size={16} />}
              </button>
            </div>
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
              onInit={(inst) => { rfRef.current = inst }}
              nodeTypes={nodeTypes}
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onSelectionChange={onSelectionChange}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.2}
              defaultViewport={{ x: 0, y: 0, zoom: 0.7 }}
              defaultEdgeOptions={{ animated: false, style: { stroke: '#000', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed as any, color: '#000' } }}
            >
              <Controls position="bottom-right" />
              <Background variant={BackgroundVariant.Lines} gap={24} size={1} />
            </ReactFlow>
          </div>
        </section>

        {inspectorOpen && (
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
                      <div style={{fontWeight:900, borderBottom:'2px solid #000', marginBottom:6}}>Properties</div>
                      {Object.entries((selectedNode.data?.params || {})).map(([k, val]) => {
                        const str = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '')
                        return (
                          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                            <span style={{ fontWeight: 900 }}>{k}</span>
                            <code style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12 }}>{str}</code>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="neo-card muted">Select a node to inspect</div>
              )}
            </div>
          </aside>
        )}

        <div className={`ide-console ${consoleOpen ? 'expanded' : 'collapsed'}`}>
          <div className="console-header">
            <button className="toggle" onClick={() => setConsoleOpen((v) => !v)}>{consoleOpen ? <FaChevronDown size={14} color="#000" /> : <FaChevronUp size={14} color="#000" />}</button>
            <div className="title" style={{flex: 1}}>Console</div>
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <span className={`live-dot ${connMode === 'sse' ? 'live-sse' : connMode === 'polling' ? 'live-poll' : 'live-idle'}`} title={connMode === 'sse' ? 'Live (SSE)' : connMode === 'polling' ? 'Live (polling fallback)' : 'Idle'} />
              <span className="muted" style={{fontSize:12}}>{connMode === 'sse' ? 'Live' : connMode === 'polling' ? 'Live (polling)' : ''}</span>
              {savingState === 'saving' && <span className="spinner" aria-label="Saving" />}
              <span className="muted" style={{fontSize:12}}>
                {savingState === 'saving' ? 'Saving…' : savingState === 'saved' ? 'Saved' : savingState === 'error' ? 'Save failed' : ''}
              </span>
            </div>
          </div>
          {consoleOpen && (
            <div className="console-lines" ref={consoleRef}>
              {liveLogs.length ? liveLogs.map((l, idx) => (<div key={idx} className="console-line">{l}</div>)) : getMockLogsForIDE().map((l, idx) => (<div key={idx} className="console-line">{l}</div>))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default IDE 