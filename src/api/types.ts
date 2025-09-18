// Shared API models
export type GraphNode = { id: string; type: string; params?: Record<string, unknown> }
export type GraphEdge = { id: string; from: string; to: string }
export type Graph = { nodes: GraphNode[]; edges: GraphEdge[] }

// Workflows
export type WorkflowCreate = { name: string; description?: string | null; webhook_slug?: string | null; graph: Graph }
export type WorkflowUpdate = { name?: string; webhook_slug?: string | null; graph?: Graph }
export type WorkflowResponse = {
  id: number
  name: string
  description?: string | null
  webhook_slug?: string | null
  graph: Graph
  created_at: string
}

// Runs
export type RunCreate = { start_input?: Record<string, unknown> | null }
export type RunResponse = {
  id: number
  workflow_id: number
  status: string
  started_at?: string | null
  finished_at?: string | null
  trigger_type?: string | null
  outputs_json?: Record<string, unknown> | null
}

// Logs
export type LogEntry = {
  id: number
  run_id: number
  node_id?: string | null
  ts: string
  level: string
  message: string
  data?: Record<string, unknown> | null
} 