import { useEffect, useState } from 'react'
import { apiClient } from '../api/client'

function HealthBadge() {
  const [ok, setOk] = useState<boolean | null>(null)

  useEffect(() => {
    let mounted = true
    apiClient.healthz().then((resp) => {
      if (!mounted) return
      setOk(!!resp?.ok)
    }).catch(() => {
      if (!mounted) return
      setOk(false)
    })
    const interval = setInterval(() => {
      apiClient.healthz().then((resp) => setOk(!!resp?.ok)).catch(() => setOk(false))
    }, 10000)
    return () => { mounted = false; clearInterval(interval) }
  }, [])

  return (
    <span className="health-badge" aria-label={ok === null ? 'loading' : ok ? 'healthy' : 'unreachable'}>
      {ok === null ? 'health: …' : ok ? 'health: ok' : 'health: down'}
    </span>
  )
}

export default HealthBadge 