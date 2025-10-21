import { useState } from 'react'
import { loginWithGoogle } from '../lib/auth'

function Login() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async () => {
    setLoading(true)
    setError(null)
    try {
      await loginWithGoogle()
    } catch (e: any) {
      setError(e?.message || 'Login failed')
      setLoading(false)
    }
  }

  return (
    <main className="landing neo-container" style={{ padding: '24px 16px' }}>
      <div className="main-wrap" style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
        <h1 className="hero-title">Welcome</h1>
        <p className="hero-sub">Sign in to build and run workflows</p>
        
        <div style={{ marginTop: 32 }}>
          <button
            className="neo-button primary"
            onClick={handleLogin}
            disabled={loading}
            style={{ fontSize: 16, padding: '12px 24px' }}
          >
            {loading ? <span className="spinner" /> : 'Login with Google'}
          </button>
        </div>

        {error && (
          <div className="neo-card" style={{ marginTop: 16, background: '#ffdad6' }}>
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>
    </main>
  )
}

export default Login

