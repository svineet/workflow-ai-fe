import { NavLink, useNavigate, useParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { apiClient } from '../api/client'
import type { WorkflowResponse } from '../api/types'
import { useModal } from '../context/ModalContext'

function WorkflowDetail() {
  const { workflowId } = useParams()
  const navigate = useNavigate()
  const { open } = useModal()
  const [apiWorkflow, setApiWorkflow] = useState<WorkflowResponse | null>(null)

  useEffect(() => {
    if (!workflowId) { setApiWorkflow(null); return }
    const numericId = Number(workflowId)
    if (!Number.isFinite(numericId)) { setApiWorkflow(null); return }
    apiClient.getWorkflow(numericId).then(setApiWorkflow).catch((e) => open({ title: 'Failed to load workflow', body: e?.message || 'Unknown error', primaryLabel: 'Close' }))
  }, [workflowId, open])

  const [runs, setRuns] = useState<Array<Pick<import('../api/types').RunResponse, 'id' | 'status' | 'started_at' | 'finished_at'>>>([])
  const [runsLoading, setRunsLoading] = useState(false)
  const [runsError, setRunsError] = useState<string | null>(null)
  useEffect(() => {
    const idNum = Number(workflowId)
    if (!Number.isFinite(idNum)) { setRuns([]); return }
    setRunsLoading(true)
    setRunsError(null)
    apiClient.listRuns()
      .then((all) => setRuns(all.filter((r) => r.workflow_id === idNum)))
      .catch((e) => setRunsError(e?.message || 'Failed to load runs'))
      .finally(() => setRunsLoading(false))
  }, [workflowId])
  const relatedRuns = useMemo(() => runs.sort((a, b) => {
    const sa = a.started_at ? Date.parse(a.started_at) : 0
    const sb = b.started_at ? Date.parse(b.started_at) : 0
    return sb - sa
  }), [runs])

  const handleRun = async () => {
    if (!workflowId || !Number.isFinite(Number(workflowId))) return
    try {
      const resp = await apiClient.startRun(Number(workflowId), {})
      navigate(`/runs/${resp.id}`)
    } catch (e: any) {
      open({ title: 'Failed to start run', body: e?.message || 'Unknown error', primaryLabel: 'Close' })
    }
  }

  return (
    <main className="neo-container">
      <div className="main-wrap">
        <div className="meta-row" style={{flexWrap:'wrap'}}>
          <h2 className="meta-title" style={{margin:0}}>
            {apiWorkflow?.name || `Workflow`}
            {workflowId && (
              <span className="pill-muted" style={{fontSize: '0.8em'}}>#{workflowId}</span>
            )}
            {apiWorkflow?.webhook_slug && (
              <span className="pill-muted" style={{fontSize: '0.8em'}}>@{apiWorkflow.webhook_slug}</span>
            )}
          </h2>
          <div className="meta-actions">
            <button className="neo-button" onClick={handleRun}>Run workflow</button>
            <NavLink to={Number.isFinite(Number(workflowId)) ? `/ide/${workflowId}` : '/ide'} className="neo-button primary">Open IDE</NavLink>
          </div>
        </div>

        <div className="neo-card" style={{marginBottom: 12}}>
          <div className="section-title">Description</div>
          <div className="muted">{apiWorkflow?.description || 'No description provided.'}</div>
        </div>

        <div className="neo-card">
          <div className="section-title">Runs</div>
          {runsLoading && <div className="muted">Loading runs…</div>}
          {runsError && <div className="muted" style={{color:'#b00020'}}>{runsError}</div>}
          {!runsLoading && !runsError && relatedRuns.length === 0 ? (
            <div className="muted">No runs found for this workflow.</div>
          ) : (!runsLoading && !runsError && relatedRuns.length > 0) ? (
            <div className="table-wrap">
              <table className="neo-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Status</th>
                    <th>Started</th>
                    <th>Duration</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {relatedRuns.map((r) => {
                    const startedAt = r.started_at ? Date.parse(r.started_at) : 0
                    const durationSeconds = r.finished_at && r.started_at ? Math.max(0, Math.round((Date.parse(r.finished_at) - Date.parse(r.started_at)) / 1000)) : 0
                    return (
                    <tr key={r.id}>
                      <td><code>{r.id}</code></td>
                      <td>{r.status}</td>
                      <td>{startedAt ? new Date(startedAt).toLocaleString() : '—'}</td>
                      <td>{durationSeconds}s</td>
                      <td><NavLink to={`/runs/${r.id}`} className="neo-button">Open</NavLink></td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  )
}

export default WorkflowDetail 