import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { runs as mockRuns } from '../mocks/runs.ts'
import { getLogsForRun } from '../mocks/logs.ts'
import { apiClient } from '../api/client'
import type { LogEntry, RunResponse } from '../api/types'

function RunsList() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runsData, setRunsData] = useState<Array<Pick<RunResponse, 'id' | 'workflow_id' | 'status' | 'started_at' | 'finished_at'>> | null>(null)

  useEffect(() => {
    setError(null)
    setLoading(true)
    apiClient.listRuns()
      .then((rows) => setRunsData(rows))
      .catch((e) => setError(e?.message || 'Failed to load runs'))
      .finally(() => setLoading(false))
  }, [])

  const rows = useMemo(() => {
    if (runsData && runsData.length > 0) {
      return [...runsData].sort((a, b) => (Date.parse(b.started_at || '0') - Date.parse(a.started_at || '0')))
        .slice(0, 5)
        .map((r) => ({
          id: String(r.id),
          status: r.status,
          startedAt: r.started_at ? new Date(r.started_at).getTime() : 0,
          durationSeconds: r.finished_at && r.started_at ? Math.max(0, Math.round((Date.parse(r.finished_at) - Date.parse(r.started_at)) / 1000)) : 0,
        }))
    }
    return [...mockRuns].sort((a, b) => b.startedAt - a.startedAt).slice(0, 5)
  }, [runsData])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [apiLogs, setApiLogs] = useState<LogEntry[] | null>(null)

  useEffect(() => {
    if (!selectedId) { setApiLogs(null); return }
    const numericId = Number(String(selectedId).replace(/[^0-9]/g, ''))
    if (!Number.isFinite(numericId)) { setApiLogs(null); return }
    apiClient.getRunLogs(numericId).then(setApiLogs).catch(() => setApiLogs(null))
  }, [selectedId])

  const logs = apiLogs ? apiLogs.map((l) => `${l.ts} [${l.level}] ${l.message}`) : (selectedId ? getLogsForRun(selectedId) : [])

  useEffect(() => {
    if (!rows.length) return
    setSelectedId(rows[0].id)
  }, [rows])

  return (
    <main className="neo-container">
      <div className="main-wrap">
        <h2>Runs</h2>
        {loading && <div className="neo-card" style={{marginBottom:12}}>Loading…</div>}
        {error && <div className="neo-card" style={{color:'#b00020', marginBottom:12}}>Error: {error}</div>}
        <div className="table-wrap neo-card">
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
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5}>No runs yet</td>
                </tr>
              ) : rows.map((r) => (
                <tr key={r.id}>
                  <td><code>{r.id}</code></td>
                  <td>{r.status}</td>
                  <td>{r.startedAt ? new Date(r.startedAt).toLocaleString() : '—'}</td>
                  <td>{r.durationSeconds}s</td>
                  <td style={{display:'flex',gap:8}}>
                    <button className="neo-button" onClick={() => setSelectedId(r.id)}>Logs</button>
                    <NavLink to={`/runs/${r.id}`} className="neo-button">Open</NavLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="neo-card" style={{marginTop:12}}>
          <div className="section-title">Logs {selectedId && (<code>({selectedId})</code>)}</div>
          <div className="log-view">
            {logs.map((l, i) => (
              <div key={i} className="log-line">{l}</div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}

export default RunsList 