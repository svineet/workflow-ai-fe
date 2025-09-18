function Templates() {
  const templates = [
    { id: 'tpl-basic', name: 'Basic Starter' },
    { id: 'tpl-http-llm', name: 'HTTP Request to LLM' },
    { id: 'tpl-gcs-export', name: 'GCS Export Output' },
  ]
  return (
    <main className="neo-container">
      <h2>Templates</h2>
      <div className="grid">
        {templates.map((t) => (
          <div key={t.id} className="neo-card">
            <div className="card-title">{t.name}</div>
            <div className="muted"><code>{t.id}</code></div>
          </div>
        ))}
      </div>
    </main>
  )
}

export default Templates 