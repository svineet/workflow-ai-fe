import { NavLink, useParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { runs } from '../mocks/runs.ts'
import { apiClient } from '../api/client'
import type { WorkflowResponse } from '../api/types'

function WorkflowDetail() {
  const { workflowId } = useParams()
  const [apiWorkflow, setApiWorkflow] = useState<WorkflowResponse | null>(null)

  useEffect(() => {
    if (!workflowId) { setApiWorkflow(null); return }
    const numericId = Number(workflowId)
    if (!Number.isFinite(numericId)) { setApiWorkflow(null); return }
    apiClient.getWorkflow(numericId).then(setApiWorkflow).catch(() => setApiWorkflow(null))
  }, [workflowId])

  const relatedRuns = useMemo(() => runs.filter(r => r.workflowId === workflowId).sort((a, b) => b.startedAt - a.startedAt), [workflowId])

  return (
    <main className="neo-container">
      <div className="main-wrap">
        <div className="meta-row">
          <h2 style={{margin:0}}>{apiWorkflow?.name || `Workflow`}</h2>
          {workflowId && (
            <span className="pill-muted">#{workflowId}</span>
          )}
        </div>
        {apiWorkflow?.webhook_slug && (
          <div className="neo-card" style={{marginBottom: 12}}>
            <div className="muted"><strong>Webhook:</strong> {apiWorkflow.webhook_slug}</div>
          </div>
        )}
        <div className="neo-card" style={{marginBottom: 12}}>
          <div className="muted">Description goes here.</div>
          <div className="spacer" />
          <NavLink to={Number.isFinite(Number(workflowId)) ? `/ide/${workflowId}` : '/ide'} className="neo-button primary">Open in IDE</NavLink>
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