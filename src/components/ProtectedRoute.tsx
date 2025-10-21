import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { getSession } from '../lib/auth'

type Props = {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: Props) {
  const [loading, setLoading] = useState(true)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    const check = async () => {
      const session = await getSession()
      setAuthed(!!session)
      setLoading(false)
    }
    check()
  }, [])

  if (loading) {
    return (
      <div className="neo-container" style={{ padding: 24, textAlign: 'center' }}>
        <span className="spinner" />
        <p className="muted">Checking authentication...</p>
      </div>
    )
  }

  if (!authed) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

