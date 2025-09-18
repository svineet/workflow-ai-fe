export type Run = {
  id: string
  status: 'running' | 'success' | 'failed'
  startedAt: number
  durationSeconds: number
  workflowId: string
}

export const runs: Run[] = [
  { id: 'run-001', status: 'success', startedAt: Date.now() - 1000 * 60 * 60, durationSeconds: 12, workflowId: 'wf-hello-world' },
  { id: 'run-002', status: 'failed', startedAt: Date.now() - 1000 * 60 * 30, durationSeconds: 4, workflowId: 'wf-http-to-llm' },
  { id: 'run-003', status: 'running', startedAt: Date.now() - 1000 * 60 * 5, durationSeconds: 0, workflowId: 'wf-hello-world' },
  { id: 'run-004', status: 'success', startedAt: Date.now() - 1000 * 60 * 120, durationSeconds: 18, workflowId: 'wf-http-to-llm' },
  { id: 'run-005', status: 'success', startedAt: Date.now() - 1000 * 60 * 240, durationSeconds: 10, workflowId: 'wf-hello-world' },
] 