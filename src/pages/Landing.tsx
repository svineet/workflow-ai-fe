import { NavLink } from 'react-router-dom'

function Landing() {
  return (
    <main className="landing neo-container">
      <div className="main-wrap">
        <h1 className="hero-title">Workflow Engine</h1>
        <p className="hero-sub">Compose, run, and observe workflows. Minimal. Neobrutalist.</p>
        <div className="cta-row">
          <NavLink to="/ide" className="neo-button primary">Open IDE</NavLink>
          <NavLink to="/workflows" className="neo-button">View Workflows</NavLink>
        </div>
      </div>
    </main>
  )
}

export default Landing 