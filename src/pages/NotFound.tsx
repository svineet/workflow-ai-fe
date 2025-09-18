import { NavLink } from 'react-router-dom'

function NotFound() {
  return (
    <main className="neo-container">
      <h2>404</h2>
      <div className="neo-card">
        <p>Page not found.</p>
        <NavLink to="/" className="neo-button">Go Home</NavLink>
      </div>
    </main>
  )
}

export default NotFound 