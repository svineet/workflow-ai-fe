import { NavLink, useNavigate, useParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { runs } from '../mocks/runs.ts'
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

  const relatedRuns = useMemo(() => runs.filter(r => r.workflowId === workflowId).sort((a, b) => b.startedAt - a.startedAt), [workflowId])

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
          {relatedRuns.length === 0 ? (
            <div className="muted">No runs found for this workflow.</div>
          ) : (
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
                  {relatedRuns.map((r) => (
                    <tr key={r.id}>
                      <td><code>{r.id}</code></td>
                      <td>{r.status}</td>
                      <td>{new Date(r.startedAt).toLocaleString()}</td>
                      <td>{r.durationSeconds}s</td>
                      <td><NavLink to={`/runs/${r.id}`} className="neo-button">Open</NavLink></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

export default WorkflowDetail 