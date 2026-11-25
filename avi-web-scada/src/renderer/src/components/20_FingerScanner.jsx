// =========================================================================
// 20_FingerScanner.jsx — USB FINGERPRINT SCANNER VIEW & ENROLLMENT FORM
// =========================================================================
import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { formatDateTime } from '../utils/dateTime'

const FP_API_BASE = 'http://127.0.0'

function FingerScanner({ users = [], currentUser }) {
  // 1. USB Scanner Telemetry & Enrolled Templates State
  const [scanner, setScanner] = useState({
    connected: false,
    deviceName: 'Searching USB Biometric Device...',
    usbPnpId: '127.0.0.1:11100',
    lastScanAt: null,
    lastMatchedUser: null,
    lastQuality: null,
    statusMessage: 'Place finger on U.are.U 4500 or click Detect USB',
    error: null
  })
  const [templates, setTemplates] = useState([])

  // 2. Form & Loading States
  const [selectedLoginId, setSelectedLoginId] = useState('')
  const [fingerLabel, setFingerLabel] = useState('Right Index')
  const [rawScanInput, setRawScanInput] = useState('')
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)

  // 3. Poll Scanner Status & SQL Templates
  const loadScannerStatus = async () => {
    try {
      const res = await fetch(`${FP_API_BASE}/status`)
      const data = await res.json()
      if (res.ok) {
        if (data.scanner) setScanner(data.scanner)
        setTemplates(data.templates || [])
      }
    } catch {
      setScanner((prev) => ({ ...prev, connected: false, error: 'Backend API offline' }))
    }
  }

  useEffect(() => {
    loadScannerStatus()
    const timer = setInterval(loadScannerStatus, 2500)
    return () => clearInterval(timer)
  }, [])

  // 4. Detect USB Fingerprint Scanner (Port 11100)
  const handleDetectUsb = async () => {
    setBusy(true)
    try {
      const res = await fetch(`${FP_API_BASE}/detect`, { method: 'POST' })
      const data = await res.json()
      if (data.scanner) setScanner(data.scanner)
      setFeedback(
        data.success
          ? `USB Scanner Connected: ${data.scanner.deviceName}`
          : 'No USB fingerprint scanner detected. Check USB port & RD Service.'
      )
    } catch (err) {
      setFeedback(`USB detection error: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  // 5. Capture & Enroll Fingerprint from U.are.U 4500
  const handleEnrollFingerprint = async (e) => {
    e.preventDefault()
    const targetUser = selectedLoginId || currentUser?.loginId || ''
    if (!targetUser) {
      setFeedback('Please select an Operator Login ID first.')
      return
    }

    const matchedUserObj = users.find((u) => u.loginId === targetUser)
    setBusy(true)
    setFeedback('Waiting for finger on U.are.U 4500 sensor (blue LED)...')
    try {
      const res = await fetch(`${FP_API_BASE}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loginId: targetUser,
          employeeId: matchedUserObj?.employeeId || '',
          fingerLabel,
          scanPayload: rawScanInput.trim() || undefined
        })
      })
      const data = await res.json()
      if (res.ok) {
        setRawScanInput('')
        if (data.scanner) setScanner(data.scanner)
        setFeedback(`Fingerprint enrolled for ${data.loginId} (Quality: ${data.quality}%).`)
        await loadScannerStatus()
      } else {
        setFeedback(data.error || 'USB fingerprint capture failed.')
      }
    } catch (err) {
      setFeedback(`Enrollment error: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  // 6. Verify Live USB Fingerprint Scan
  const handleVerifyScan = async () => {
    setBusy(true)
    setFeedback('Place finger on U.are.U 4500 sensor to verify...')
    try {
      const res = await fetch(`${FP_API_BASE}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanPayload: rawScanInput.trim() || undefined })
      })
      const data = await res.json()
      if (res.ok && data.matched) {
        setRawScanInput('')
        setFeedback(`MATCH VERIFIED: ${data.loginId} (${data.fingerLabel}) · Quality ${data.quality}%`)
        await loadScannerStatus()
      } else {
        setFeedback(data.message || data.error || 'Fingerprint not matched.')
      }
    } catch (err) {
      setFeedback(`Verification error: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  // 7. Delete Enrolled Template
  const handleDeleteTemplate = async (id) => {
    try {
      await fetch(`${FP_API_BASE}/templates/${id}`, { method: 'DELETE' })
      setFeedback('Enrolled fingerprint template deleted.')
      await loadScannerStatus()
    } catch (err) {
      setFeedback(`Delete failed: ${err.message}`)
    }
  }
  return (
    <section className="professional-screen finger-scanner-screen" aria-label="USB Fingerprint scanner">
      {/* =================================================================== */}
      {/* SECTION 1: HEADER & USB CONNECTION BADGE                            */}
      {/* =================================================================== */}
      <header className="screen-heading">
        <div>
          <span className="screen-eyebrow">SECURITY &amp; 21 CFR PART 11 / USB BIOMETRIC</span>
          <h1>USB Fingerprint scanner</h1>
          <p>Read U.are.U 4500 biometric sensor, enroll operator templates, and verify signatures.</p>
        </div>
        <span className={`batch-state-badge is-${scanner.connected ? 'running' : 'stopped'}`}>
          <i /> {scanner.connected ? 'USB CONNECTED' : 'USB OFFLINE'}
        </span>
      </header>

      {/* =================================================================== */}
      {/* SECTION 2: USB DEVICE TELEMETRY STRIP                               */}
      {/* =================================================================== */}
      <div
        className="selected-batch-strip"
        style={{
          display: 'grid',
          gridTemplateColumns: '1.3fr 1fr 0.9fr auto',
          alignItems: 'center',
          gap: '14px'
        }}
      >
        <div>
          <span>USB BIOMETRIC DEVICE</span>
          <strong>{scanner.deviceName}</strong>
        </div>
        <div>
          <span>LAST VERIFIED OPERATOR</span>
          <strong>{scanner.lastMatchedUser || '--'}</strong>
        </div>
        <div>
          <span>LAST SCAN / QUALITY</span>
          <strong>
            {scanner.lastScanAt
              ? `${formatDateTime(scanner.lastScanAt)} (${scanner.lastQuality ?? '--'}%)`
              : '--'}
          </strong>
        </div>
        <div style={{ justifySelf: 'end' }}>
          <button
            className="table-action-neutral"
            disabled={busy}
            onClick={handleDetectUsb}
            style={{ height: '36px', whiteSpace: 'nowrap' }}
            type="button"
          >
            {busy ? 'CHECKING...' : 'DETECT USB'}
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* SECTION 3: CAPTURE, ENROLL & VERIFY FORM                            */}
      {/* =================================================================== */}
      <section className="batch-create-section" aria-labelledby="usb-fp-enroll-title">
        <div className="subsection-heading">
          <div>
            <span>USB SENSOR CAPTURE</span>
            <h2 id="usb-fp-enroll-title">Enroll or verify fingerprint</h2>
          </div>
          <span>{scanner.statusMessage}</span>
        </div>
        <form
          className="batch-create-form"
          onSubmit={handleEnrollFingerprint}
          style={{
            display: 'grid',
            gridTemplateColumns: '1.1fr 0.9fr 1.4fr auto auto',
            alignItems: 'end',
            gap: '10px'
          }}
        >
          <label>
            Operator Login ID
            <select
              onChange={(e) => setSelectedLoginId(e.target.value)}
              style={{ width: '100%', height: '36px' }}
              value={selectedLoginId || currentUser?.loginId || ''}
            >
              <option value="">-- Select User --</option>
              {users.map((u) => (
                <option key={u.loginId} value={u.loginId}>
                  {u.loginId} ({u.name})
                </option>
              ))}
            </select>
          </label>

          <label>
            Finger
            <select
              onChange={(e) => setFingerLabel(e.target.value)}
              style={{ width: '100%', height: '36px' }}
              value={fingerLabel}
            >
              <option value="Right Index">Right Index</option>
              <option value="Right Thumb">Right Thumb</option>
              <option value="Left Index">Left Index</option>
              <option value="Left Thumb">Left Thumb</option>
            </select>
          </label>

          <label>
            Manual / HID Input (Leave blank for U.are.U 4500 capture)
            <input
              onChange={(e) => setRawScanInput(e.target.value)}
              placeholder="Leave blank to trigger blue sensor LED..."
              style={{ width: '100%', height: '36px' }}
              type="password"
              value={rawScanInput}
            />
          </label>

          <button
            className="primary-screen-action"
            disabled={busy}
            style={{ height: '36px', whiteSpace: 'nowrap' }}
            type="submit"
          >
            {busy ? 'SCANNING...' : 'CAPTURE & ENROLL'}
          </button>

          <button
            className="table-action-neutral"
            disabled={busy}
            onClick={handleVerifyScan}
            style={{ height: '36px', whiteSpace: 'nowrap' }}
            type="button"
          >
            VERIFY SCAN
          </button>
        </form>
        {feedback && (
          <p className="batch-feedback" role="status">
            {feedback}
          </p>
        )}
      </section>

      {/* =================================================================== */}
      {/* SECTION 4: REGISTERED TEMPLATES TABLE                               */}
      {/* =================================================================== */}
      <section className="batch-register-section" aria-labelledby="usb-fp-table-title">
        <div className="subsection-heading">
          <div>
            <span>SQL DATABASE (AVI_IRS_UM)</span>
            <h2 id="usb-fp-table-title">Enrolled USB fingerprint templates</h2>
          </div>
          <span>{templates.length} records</span>
        </div>
        <div className="professional-table-wrap batch-register-table-wrap">
          <table className="professional-table batch-register-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Login ID</th>
                <th>Employee ID</th>
                <th>Finger</th>
                <th>Quality</th>
                <th>Template Hash</th>
                <th>Enrolled Date/Time</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((item) => (
                <tr key={item.Id}>
                  <td>{item.Id}</td>
                  <td>{item.LoginId}</td>
                  <td>{item.EmployeeId || '-'}</td>
                  <td>{item.FingerLabel}</td>
                  <td>{item.Quality ?? '--'}%</td>
                  <td>
                    <code>{item.TemplatePreview}</code>
                  </td>
                  <td>{item.CreatedAt ? formatDateTime(item.CreatedAt) : '-'}</td>
                  <td>
                    <button
                      className="table-action-neutral"
                      onClick={() => handleDeleteTemplate(item.Id)}
                      type="button"
                    >
                      REMOVE
                    </button>
                  </td>
                </tr>
              ))}
              {templates.length === 0 && (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', opacity: 0.7 }}>
                    No USB fingerprint templates enrolled yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  )
}

FingerScanner.propTypes = {
  users: PropTypes.arrayOf(PropTypes.object),
  currentUser: PropTypes.object
}

export default FingerScanner
