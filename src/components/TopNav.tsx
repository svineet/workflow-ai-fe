import { NavLink } from 'react-router-dom'
import HealthBadge from './HealthBadge'

function TopNav() {
  const env: any = (import.meta as any)?.env || {}
  const isDev = env.MODE !== 'production'
  return (
    <header className="top-nav">
      <div className="brand">
        <NavLink to="/" className="brand-link">workflow-ai</NavLink>
      </div>
      <nav className="nav-links">
        <NavLink to="/workflows" className="nav-link">Workflows</NavLink>
        <NavLink to="/ide" className="nav-link">IDE</NavLink>
        <NavLink to="/integrations" className="nav-link">Integrations</NavLink>
        <NavLink to="/runs" className="nav-link">Runs</NavLink>
        {isDev && <HealthBadge />}
      </nav>
    </header>
  )
}

export default TopNav 