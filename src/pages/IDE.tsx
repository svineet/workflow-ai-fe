import { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import ReactFlow, { addEdge, Background, BackgroundVariant, Controls, Connection, Edge, Node, OnEdgesChange, OnNodesChange, applyNodeChanges, applyEdgeChanges, MarkerType } from 'reactflow'
import type { ReactFlowInstance } from 'reactflow'
import 'reactflow/dist/style.css'
import * as blocks from '../mocks/blocks.ts'
import { getMockLogsForIDE } from '../mocks/logs.ts'
import { useParams } from 'react-router-dom'
import { apiClient } from '../api/client'
import { API_BASE_URL } from '../api/config'
import type { LogEntry, RunResponse } from '../api/types'
import { FaCog, FaChevronDown, FaChevronUp, FaChevronLeft, FaChevronRight } from 'react-icons/fa'
import { useModal } from '../context/ModalContext'
import ConfigNode from '../nodes/ConfigNode'
import AgentNode from '../nodes/AgentNode.tsx'
import ToolNode from '../nodes/ToolNode.tsx'
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

// Generate short, easy-to-type node IDs based on block type
function makeSimpleId(existingIds: Set<string>, typeName: string): string {
  const baseRaw = String(typeName || 'n')
  const base = baseRaw.split('.')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'n'
  if (!existingIds.has(base)) return base
  for (let i = 2; i < 10000; i++) {
    const candidate = `${base}${i}`
    if (!existingIds.has(candidate)) return candidate
  }
  return `${base}${Date.now() % 10000}`
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
  const [inspectorPanelOpen, setInspectorPanelOpen] = useState<boolean>(true)
  const [inspectorSectionOpen, setInspectorSectionOpen] = useState<boolean>(true)
  const [schemaOpen, setSchemaOpen] = useState<boolean>(false)
  const [runtimeOpen, setRuntimeOpen] = useState<boolean>(false)
  const [graphLoaded, setGraphLoaded] = useState<boolean>(false)
  const consoleRef = useRef<HTMLDivElement | null>(null)
  const [consoleOpen, setConsoleOpen] = useState<boolean>(true)
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const saveTimerRef = useRef<any>(null)
  const lastSavedGraphRef = useRef<string>('')
  const [connMode, setConnMode] = useState<'idle' | 'sse' | 'polling'>('idle')
 
  // Reliable fitView helper that mimics Controls' behavior
  const fitViewReliable = useCallback(() => {
    const inst = rfRef.current
    if (!inst) return
    try { inst.fitView({ padding: 0.12, includeHiddenNodes: true, duration: 300 }) } catch {}
  }, [])

  // Live run streaming state
  const [currentRunId, setCurrentRunId] = useState<number | null>(null)
  const [runStore, setRunStore] = useState<Record<number, RunResponse>>({})
  const currentRunIdRef = useRef<number | null>(null)
  const [liveLogs, setLiveLogs] = useState<string[]>([])
  const [activeNodeIds, setActiveNodeIds] = useState<Set<string>>(new Set())
  const lastLogIdRef = useRef<number>(0)
  const statusRef = useRef<string>('')
  const pollTimersRef = useRef<{ logs: any | null; status: any | null }>({ logs: null, status: null })
  const esRef = useRef<EventSource | null>(null)

  // Derived current run data
  const runData = useMemo(() => (currentRunId && runStore[currentRunId]) ? runStore[currentRunId] : null, [currentRunId, runStore])

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
          setGraphLoaded(true)
        } else {
          const laid = layoutGraph(blocks.defaultNodes as any, blocks.defaultEdges as any)
          setNodes(laid.nodes)
          setEdges(laid.edges)
          setGraphLoaded(true)
        }
        setSpecs((specsResp.blocks as unknown as any[]) || [])
      } catch (e: any) {
        open({ title: 'Failed to load workflow', body: e?.message || 'Unknown error', primaryLabel: 'Close' })
      }
    }
    load()
  }, [workflowId, open])

  useEffect(() => {
    if (!graphLoaded) return
    // Try multiple times to account for container/layout settling
    const t1 = setTimeout(() => { fitViewReliable() }, 0)
    const t2 = setTimeout(() => { fitViewReliable() }, 150)
    const t3 = setTimeout(() => { fitViewReliable() }, 400)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [graphLoaded, fitViewReliable])

  // Also refit when inspector panel toggles (width change affects viewport)
  useEffect(() => {
    if (!graphLoaded) return
    const t = setTimeout(() => { fitViewReliable() }, 150)
    return () => clearTimeout(t)
  }, [inspectorPanelOpen, graphLoaded, fitViewReliable])

  useEffect(() => {
    if (!consoleRef.current) return
    consoleRef.current.scrollTop = consoleRef.current.scrollHeight
  }, [liveLogs.length])

  // Update nodes with runtime data when available
  useEffect(() => {
    if (!runData?.outputs_json) return
    
    const outputs = runData.outputs_json as Record<string, any>

    setNodes((prev) => prev.map((n) => {
      const upstreamData: any = {}
      // Find edges that target this node and collect upstream outputs
      edges.filter(e => e.target === n.id).forEach(edge => {
        const sourceOutput = outputs[edge.source]
        if (sourceOutput) upstreamData[edge.source] = sourceOutput
      })
      
      // Compute connected agent ids for tool nodes (via tool edges)
      const connectedAgents: string[] = []
      if ((n as any)?.type === 'tool') {
        edges.forEach((e) => {
          const kind = (e as any)?.data?.kind || 'control'
          if (kind !== 'tool') return
          if (e.source === n.id || e.target === n.id) {
            const other = e.source === n.id ? e.target : e.source
            const otherNode = prev.find((pn) => pn.id === other)
            if (otherNode && ((otherNode as any)?.type === 'agent' || (otherNode as any)?.data?.schema?.kind === 'agent')) {
              if (!connectedAgents.includes(other)) connectedAgents.push(other)
            }
          }
        })
      }

      return {
        ...n,
        data: {
          ...n.data,
          active: activeNodeIds.has(n.id),
          runData: runData,
          upstreamData: upstreamData,
          connectedAgents,
        }
      }
    }))
  }, [runData, activeNodeIds, edges])

  useEffect(() => {
    setNodes((prev) => prev.map((n) => ({ ...n, data: { ...n.data, active: activeNodeIds.has(n.id) } })))
  }, [activeNodeIds])

  const onNodesChange = useCallback<OnNodesChange>((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), [])
  const onEdgesChange = useCallback<OnEdgesChange>((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), [])
  const onConnect = useCallback((connection: Connection) => setEdges((eds) => addEdge(connection, eds)), [])
  
  // Tool connection validation and add
  const onConnectStart = undefined
  const onConnectEnd = undefined
  const onConnectValidate = useCallback((conn: Connection) => {
    const { source, target, sourceHandle, targetHandle } = conn
    const src = nodes.find((n) => n.id === source)
    const tgt = nodes.find((n) => n.id === target)
    const isAgentHandle = sourceHandle === 'tools' || targetHandle === 'tools'
    if (!isAgentHandle) return true // normal control edge
    const isTool = (n?: Node) => {
      if (!n) return false
      const t = String((n as any)?.data?.typeName || '')
      const spec = (n as any)?.data?.schema
      const extrasTool = !!spec?.extras?.toolCompatible
      return t.startsWith('tool.') || extrasTool
    }
    const isAgent = (n?: Node) => {
      if (!n) return false
      const nodeType = (n as any)?.type
      const typeName = String((n as any)?.data?.typeName || '')
      const spec = (n as any)?.data?.schema
      const hasToolsConnector = Array.isArray(spec?.extras?.connectors) && spec.extras.connectors.some((c: any) => c?.name === 'tools')
      return nodeType === 'agent' || spec?.kind === 'agent' || typeName.startsWith('agent.') || hasToolsConnector
    }
    if (source && target) {
      const ok = (isAgent(src) && isTool(tgt)) || (isAgent(tgt) && isTool(src))
      // Prevent duplicate tool edges between the same pair
      const dup = edges.some((e) => {
        const kind = (e as any)?.data?.kind || 'control'
        return kind === 'tool' && ((e.source === source && e.target === target) || (e.source === target && e.target === source))
      })
      return !!ok && !dup
    }
    return false
  }, [nodes, edges])
  const onConnectTool = useCallback((conn: Connection) => {
    if (!onConnectValidate(conn)) return
    // Normalize direction: agent (with tools handle) should be source; tool should be target
    const srcNode = nodes.find(n => n.id === conn.source)
    const tgtNode = nodes.find(n => n.id === conn.target)
    const isAgent = (n?: Node | undefined) => {
      if (!n) return false
      const nodeType = (n as any)?.type
      const typeName = String((n as any)?.data?.typeName || '')
      const spec = (n as any)?.data?.schema
      const hasToolsConnector = Array.isArray(spec?.extras?.connectors) && spec.extras.connectors.some((c: any) => c?.name === 'tools')
      return nodeType === 'agent' || spec?.kind === 'agent' || typeName.startsWith('agent.') || hasToolsConnector
    }
    const isTool = (n?: Node | undefined) => {
      if (!n) return false
      const t = String((n as any)?.data?.typeName || '')
      const spec = (n as any)?.data?.schema
      const extrasTool = !!spec?.extras?.toolCompatible
      return t.startsWith('tool.') || extrasTool || (n as any)?.type === 'tool'
    }
    let source = String(conn.source)
    let target = String(conn.target)
    let sourceHandle = conn.sourceHandle
    let targetHandle = conn.targetHandle
    if (!isAgent(srcNode) && isAgent(tgtNode)) {
      // swap so agent is source
      source = String(conn.target)
      target = String(conn.source)
      sourceHandle = conn.targetHandle
      targetHandle = conn.sourceHandle
    }
    // Ensure the agent's tools connector is the source handle and the tool node's top handle is target
    sourceHandle = 'tools'
    const targetNode = nodes.find(n => n.id === target)
    if (isTool(targetNode)) targetHandle = 'tool'

    const id = `tool-${source}-${target}-${Date.now()}`
    setEdges((prev) => [...prev, {
      id,
      source,
      target,
      sourceHandle,
      targetHandle,
      data: { kind: 'tool' },
      markerEnd: undefined,
      style: { stroke: '#000', strokeWidth: 2 }
    } as Edge])
  }, [onConnectValidate, nodes])

  const onSelectionChange = useCallback((params: { nodes: Node[]; edges: Edge[] }) => {
    const sel = params?.nodes && params.nodes[0]
    setSelectedNodeId(sel ? sel.id : null)
    if (sel) {
      setInspectorPanelOpen(true)
      setInspectorSectionOpen(true)
    }
  }, [])

  const nodeTypes = useMemo(() => ({ config: ConfigNode, agent: AgentNode, tool: ToolNode }), [])

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

  // Immediate save helper (used before Run)
  const flushSave = useCallback(async () => {
    if (!workflowId || !Number.isFinite(Number(workflowId))) return
    const graph = mapRFToServerGraph(nodes, edges)
    const serialized = JSON.stringify(graph)
    await apiClient.updateWorkflow(Number(workflowId), { graph })
    lastSavedGraphRef.current = serialized
  }, [nodes, edges, workflowId])

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
      es.onopen = () => { setConnMode('sse') }
      es.onmessage = (ev) => {
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
            const rid = currentRunIdRef.current || runId
            if (rid && rid === (currentRunIdRef.current)) {
              apiClient.getRun(rid).then(finalRun => {
                setRunStore((store) => ({ ...store, [rid]: finalRun }))
              }).catch(() => {})
            }
          } else if (data?.type === 'status') {
            statusRef.current = data.status
            appendInfoLine(`Run status: ${data.status}`)
            if (data.status === 'succeeded' || data.status === 'failed') {
              // Fetch final run data with outputs when completed
              const rid = currentRunIdRef.current || runId
              if (rid && rid === (currentRunIdRef.current)) {
                try {
                  apiClient.getRun(rid).then(finalRun => setRunStore((store) => ({ ...store, [rid]: finalRun }))).catch(console.error)
                } catch {}
              }
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
      const existing = new Set(prev.map((n) => n.id))
      const id = makeSimpleId(existing, blockType)
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

  // Persist latest graph immediately (used before Run) to ensure settings like JSON payload are saved as objects
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
      // Save current graph/settings to backend to avoid stale or stringified payloads
      await flushSave()
      setLiveLogs([])
      setActiveNodeIds(new Set())
      // Clear all prior runs completely
      setRunStore({})
      lastLogIdRef.current = 0
      // Clear any prior runData/upstreamData from nodes to avoid stale Show output
      setNodes((prev) => prev.map((n) => ({
        ...n,
        data: { ...n.data, runData: null, upstreamData: {} }
      })))
      const resp = await apiClient.startRun(Number(workflowId), {})
      setCurrentRunId(resp.id)
      currentRunIdRef.current = resp.id
      // fetch fresh run data baseline immediately so Show nodes can render if very fast
      try { const r = await apiClient.getRun(resp.id); setRunStore((s) => ({ ...s, [resp.id]: r })) } catch {}
      // immediate first pull of logs to populate console quickly
      startSSE(resp.id)
    } catch (e: any) {
      open({ title: 'Failed to start run', body: e?.message || 'Unknown error', primaryLabel: 'Close' })
    }
  }, [workflowId, open, startSSE, flushSave])

  return (
    <div className="page-ide" style={{padding: 0, margin: 0}}>
      <div className="nav-offset" />
      <div className={`ide-layout ${inspectorPanelOpen ? 'inspector-open' : ''}`}>
        <section className="ide-canvas">
          <div className="canvas-frame">
            <button className="neo-button toolbox-toggle" onClick={() => setToolboxOpen((v) => !v)}><FaCog size={16} /></button>
            <div className="ide-actions">
              <button className="neo-button run-button" onClick={handleRun}>Run</button>
              <button className="neo-button inspector-toggle" onClick={() => setInspectorPanelOpen((v) => !v)}>
                {inspectorPanelOpen ? <FaChevronRight size={16} /> : <FaChevronLeft size={16} />}
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
              onInit={(inst) => { rfRef.current = inst; setTimeout(() => { fitViewReliable() }, 0) }}
              nodeTypes={nodeTypes}
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={(c) => {
                if (c.sourceHandle === 'tools' || c.targetHandle === 'tools') onConnectTool(c)
                else onConnect(c)
              }}
              isValidConnection={(c) => {
                if (c.sourceHandle === 'tools' || c.targetHandle === 'tools') return onConnectValidate(c)
                return true
              }}
              onSelectionChange={onSelectionChange}
              fitView
              fitViewOptions={{ padding: 0.12, includeHiddenNodes: true }}
              minZoom={0.2}
              defaultViewport={{ x: 0, y: 0, zoom: 0.7 }}
              defaultEdgeOptions={{ animated: false, style: { stroke: '#000', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed as any, color: '#000' } }}
            >
              <Controls position="bottom-right" />
              <Background variant={BackgroundVariant.Lines} gap={24} size={1} />
            </ReactFlow>
          </div>
        </section>

        {inspectorPanelOpen && (
          <aside className="ide-inspector">
            {/* Inspector Accordion */}
            <div className="sidebar-section accordion-section">
              <div className="section-title" style={{cursor:'pointer', display:'flex', alignItems:'center', gap:8}} onClick={() => setInspectorSectionOpen(!inspectorSectionOpen)}>
                <span>{inspectorSectionOpen ? '▼' : '▶'}</span>
                <span>Inspector</span>
              </div>
              {inspectorSectionOpen && (
                <div style={{padding:12}}>
                  {selectedNode ? (
                    <div>
                      <div style={{display:'flex', alignItems:'center', gap:8}}>
                        <div><strong>Label:</strong> {selectedNode.data?.label ?? '—'}</div>
                        <span className="pill-muted" style={{fontSize:11}}>#{selectedNode.id}</span>
                      </div>
                      <div style={{marginTop:4}}><strong>Type:</strong> {selectedNode.type ?? 'default'}</div>
                      <div><strong>Position:</strong> {Math.round(selectedNode.position.x)}, {Math.round(selectedNode.position.y)}</div>
                      
                      {/* Current Settings */}
                      {selectedNode.data?.schema && (
                        <div style={{marginTop:12}}>
                          <div style={{fontWeight:900, borderBottom:'2px solid #000', marginBottom:6}}>Current Settings</div>
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
                    <div className="muted">Select a node to inspect</div>
                  )}
                </div>
              )}
            </div>

            {/* Schema Accordion */}
            <div className="sidebar-section accordion-section">
              <div className="section-title" style={{cursor:'pointer', display:'flex', alignItems:'center', gap:8}} onClick={() => setSchemaOpen(!schemaOpen)}>
                <span>{schemaOpen ? '▼' : '▶'}</span>
                <span>Schema</span>
              </div>
              {schemaOpen && selectedNode?.data?.schema && (
                <div style={{padding:12}}>
                  {selectedNode.data.schema.settings_schema && (
                    <div style={{marginBottom:12}}>
                      <div style={{fontWeight:700, fontSize:14, marginBottom:4}}>Settings Schema:</div>
                      <code style={{fontSize:11, display:'block', whiteSpace:'pre-wrap', wordBreak:'break-word', background:'#f5f5f5', padding:6, border:'1px solid #ccc'}}>
                        {JSON.stringify(selectedNode.data.schema.settings_schema, null, 2)}
                      </code>
                    </div>
                  )}
                  {selectedNode.data.schema.output_schema && (
                    <div style={{marginBottom:8}}>
                      <div style={{fontWeight:700, fontSize:14, marginBottom:4}}>Output Schema:</div>
                      <code style={{fontSize:11, display:'block', whiteSpace:'pre-wrap', wordBreak:'break-word', background:'#f5f5f5', padding:6, border:'1px solid #ccc'}}>
                        {JSON.stringify(selectedNode.data.schema.output_schema, null, 2)}
                      </code>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Runtime Data Accordion */}
            <div className="sidebar-section accordion-section">
              <div className="section-title" style={{cursor:'pointer', display:'flex', alignItems:'center', gap:8}} onClick={() => setRuntimeOpen(!runtimeOpen)}>
                <span>{runtimeOpen ? '▼' : '▶'}</span>
                <span>Runtime Data</span>
              </div>
              {runtimeOpen && runData?.outputs_json && selectedNode && (
                <div style={{padding:12}}>
                  <div style={{fontSize:12, marginBottom:8, color:'#666'}}>
                    Run #{runData.id} ({runData.status}) {currentRunId === runData.id ? '(current)' : '(latest)'}
                  </div>
                  
                  {(runData.outputs_json as any)[selectedNode.id] && (
                    <div style={{marginBottom:12}}>
                      <div style={{fontWeight:700, fontSize:14, marginBottom:4}}>Node Output:</div>
                      <code style={{fontSize:11, display:'block', whiteSpace:'pre-wrap', wordBreak:'break-word', background:'#e8f5e8', padding:6, border:'1px solid #90ee90'}}>
                        {JSON.stringify((runData.outputs_json as any)[selectedNode.id], null, 2)}
                      </code>
                    </div>
                  )}
                  
                  <div style={{marginBottom:8}}>
                    <div style={{fontWeight:700, fontSize:14, marginBottom:4}}>Node Inputs:</div>
                    {(((): JSX.Element => {
                      const outputs = (runData.outputs_json || {}) as any
                      const upstreamOutputs: any = {}
                      // Find edges that target this node
                      edges.filter(e => e.target === selectedNode.id).forEach(edge => {
                        const sourceOutput = outputs[edge.source]
                        if (sourceOutput) upstreamOutputs[edge.source] = sourceOutput
                      })
                      const nodeInputs = {
                        settings: selectedNode.data?.params || {},
                        upstream: upstreamOutputs,
                        trigger: {},
                      }
                      return (
                        <code style={{fontSize:11, display:'block', whiteSpace:'pre-wrap', wordBreak:'break-word', background:'#f0f8ff', padding:6, border:'1px solid #87ceeb'}}>
                          {JSON.stringify(nodeInputs, null, 2)}
                        </code>
                      )
                    }))()}
                  </div>
                </div>
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