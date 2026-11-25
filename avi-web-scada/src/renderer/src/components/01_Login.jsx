import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'

const API_URL = 'http://' + '127.0.0.1' + ':5000/api'

function Login({ onLoginSuccess }) {
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState('Access is restricted to authorized users.')
  const [dbOnline, setDbOnline] = useState(null)

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((res) => res.json())
      .then((data) => setDbOnline(Boolean(data.dbConnected)))
      .catch(() => setDbOnline(false))
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setStatusMessage('Verifying operator credentials...')
    const cleanId = loginId.trim()

    try {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId: cleanId, password })
      })
      const data = await res.json()

      if (!res.ok) {
        const msg = data.error || 'Invalid credentials.'
        setStatusMessage(msg)

        // Log failed login attempt to AVI_IRS_DATA.dbo.AuditTrail
        fetch(`${API_URL}/audit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            batchId: 'VIAL_BATCH_A',
            user: cleanId || 'Unknown',
            action: 'Failed login attempt',
            details: msg
          })
        }).catch(() => {})

        alert(msg)
        setLoading(false)
        return
      }

      setStatusMessage(`Welcome, ${data.user.name} (${data.user.group}).`)
      if (onLoginSuccess) {
        onLoginSuccess(data.user)
      }
    } catch (err) {
      const msg = 'Cannot reach authentication server. Please check connection.'
      setStatusMessage(msg)
      alert(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="hmi-login">
      <header className="hmi-topbar">
        <div className="terminal-brand">
          <strong>SCADA CONTROL</strong>
          <span>OPERATOR ACCESS TERMINAL</span>
        </div>

        <div className="topbar-title">
          <span>CONTROL SYSTEM</span>
          <strong>Operator Login</strong>
        </div>

        <div className="terminal-status">
          <i aria-hidden="true" />
          <span>
            {dbOnline === null
              ? 'CHECKING SQL...'
              : dbOnline
                ? 'SECURE TERMINAL · SQL ONLINE'
                : 'SERVER OFFLINE'}
          </span>
        </div>
      </header>

      <section className="hmi-frame" aria-labelledby="login-title">
        <div className="frame-titlebar">
          <span id="login-title">Machine Access</span>
          <span className="frame-reference">USER AUTHENTICATION / 01</span>
        </div>

        <div className="frame-content">
          <aside className="system-panel" aria-label="System access information">
            <div className="access-emblem" aria-hidden="true">
              <svg viewBox="0 0 64 64">
                <path d="M32 6 53 14v15c0 14-9 24-21 29C20 53 11 43 11 29V14l21-8Z" />
                <path d="m23 32 6 6 13-14" />
              </svg>
            </div>
            <p className="system-kicker">AUTHORIZED PERSONNEL ONLY</p>
            <h1>
              Welcome
              <br />
              to the control room.
            </h1>
            <p className="system-description">
              Sign in with your assigned operator account to access the machine interface.
            </p>

            <div className="system-readouts">
              <div>
                <span>APPLICATION</span>
                <strong>MACHINE CONTROL SYSTEM</strong>
              </div>
              <div>
                <span>ACCESS LEVEL</span>
                <strong>OPERATOR AUTHENTICATION</strong>
              </div>
              <div>
                <span>SESSION</span>
                <strong>
                  <i /> AWAITING SIGN-IN
                </strong>
              </div>
            </div>
          </aside>

          <div className="frame-divider" aria-hidden="true" />

          <section className="credentials-panel" id="login-panel" aria-labelledby="credentials-title">
            <div className="credentials-heading">
              <p>SECURE ACCESS</p>
              <h2 id="credentials-title">Sign in</h2>
              <span>Enter your credentials to continue.</span>
            </div>

            <form className="login-form" onSubmit={handleSubmit}>
              <label htmlFor="email">User ID</label>
              <input
                autoComplete="username"
                id="email"
                name="email"
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="Enter your user ID"
                required
                type="text"
                value={loginId}
              />

              <div className="password-label-row">
                <label htmlFor="password">Password</label>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? 'HIDE' : 'SHOW'}
                </button>
              </div>
              <input
                autoComplete="current-password"
                id="password"
                name="password"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                type={showPassword ? 'text' : 'password'}
                value={password}
              />

              <label className="remember-option">
                <input name="remember" type="checkbox" />
                <span>Keep me signed in</span>
              </label>

              <button className="sign-in-button" disabled={loading} type="submit">
                <span>{loading ? 'VERIFYING...' : 'LOGIN'}</span>
                <span aria-hidden="true">➔</span>
              </button>
              <p className="form-message" role="status" aria-live="polite">
                {statusMessage}
              </p>
            </form>
          </section>
        </div>

        <footer className="hmi-footer">
          <span>
            MACHINE CONTROL <i /> ACCESS TERMINAL
          </span>
          <span>Developed By: Avinash Kuhada</span>
        </footer>
      </section>
    </main>
  )
}

Login.propTypes = {
  onLoginSuccess: PropTypes.func
}

export default Login
