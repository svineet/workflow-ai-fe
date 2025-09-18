function Integrations() {
  const integrations = [
    { id: 'gcs', name: 'Google Cloud Storage', status: 'Not connected' },
    { id: 'http', name: 'HTTP', status: 'Ready' },
    { id: 'llm', name: 'LLM', status: 'Not configured' },
  ]
  return (
    <main className="neo-container">
      <div className="main-wrap">
        <h2>Integrations</h2>
        <div className="grid">
          {integrations.map((i) => (
            <div key={i.id} className="neo-card">
              <div className="card-title">{i.name}</div>
              <div className="muted">{i.status}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

export default Integrations 