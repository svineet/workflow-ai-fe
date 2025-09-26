import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function IntegrationsSuccess() {
  const nav = useNavigate()
  useEffect(() => {
    const t = setTimeout(() => nav('/integrations', { replace: true }), 1200)
    return () => clearTimeout(t)
  }, [nav])
  return (
    <main className="neo-container">
      <div className="main-wrap">
        <div className="neo-card">
          <h2>Integration Connected</h2>
          <div className="muted">You will be redirected to Integrations shortly…</div>
        </div>
      </div>
    </main>
  )
}

export default IntegrationsSuccess 