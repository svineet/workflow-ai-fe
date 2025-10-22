import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const loc = useLocation()

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Supabase automatically parses the hash and sets the session
        const { data, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError
        const usp = new URLSearchParams(loc.search)
        const next = usp.get('next') || '/'
        const carryPrompt = usp.get('prompt') || ''
        if (carryPrompt) {
          try { sessionStorage.setItem('landing_prompt', carryPrompt) } catch {}
        }
        if (data.session) {
          // Redirect to home/workflows after successful auth
          navigate(next)
        } else {
          setError('No session found')
          setTimeout(() => navigate('/login'), 2000)
        }
      } catch (e: any) {
        setError(e?.message || 'Auth callback failed')
        setTimeout(() => navigate('/login'), 2000)
      }
    }
    handleCallback()
  }, [navigate, loc.search])

  return (
    <main className="landing neo-container" style={{ padding: '24px 16px' }}>
      <div className="main-wrap" style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
        {error ? (
          <>
            <h1 className="hero-title">Auth Error</h1>
            <p>{error}</p>
            <p className="muted">Redirecting to login...</p>
          </>
        ) : (
          <>
            <h1 className="hero-title">Authenticating...</h1>
            <div style={{ marginTop: 16 }}>
              <span className="spinner" />
            </div>
          </>
        )}
      </div>
    </main>
  )
}

export default AuthCallback

