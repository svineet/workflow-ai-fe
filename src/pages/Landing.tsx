import { NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { apiClient } from '../api/client'

function Landing() {
  const navigate = useNavigate()
  const [text, setText] = useState<string>('')
  const [building, setBuilding] = useState<boolean>(false)

  const handleBuild = async () => {
    if (building) return
    setBuilding(true)
    try {
      const res = await apiClient.assistantNew(text || 'New workflow from assistant')
      const id = res?.id
      if (typeof id === 'number' && Number.isFinite(id)) {
        navigate(`/ide/${id}`)
      } else {
        navigate('/ide')
      }
    } catch (e) {
      navigate('/ide')
    } finally {
      setBuilding(false)
    }
  }

  return (
    <main className="landing neo-container" style={{padding: '24px 16px'}}>
      <div className="main-wrap" style={{maxWidth: 960, margin: '0 auto'}}>
        <h1 className="hero-title">Workflow Engine</h1>
        <p className="hero-sub">Compose, run, and observe workflows. Minimal. Neobrutalist.</p>

        <div className="builder-wrap">
          <textarea
            className="neo-input builder-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Describe your workflow goals or paste a spec..."
            rows={10}
            aria-label="Workflow description"
          />
          <button
            className="neo-button builder-button"
            onClick={handleBuild}
            disabled={building}
            aria-label="Build workflow"
          >
            {building ? <span className="spinner" aria-hidden /> : 'Build'}
          </button>
        </div>

        <div className="cta-row" style={{marginTop: 16}}>
          <NavLink to="/ide" className="neo-button primary">Open IDE</NavLink>
          <NavLink to="/workflows" className="neo-button">View Workflows</NavLink>
        </div>
      </div>
    </main>
  )
}

export default Landing 