// =========================================================================
// 06_BatchControl.jsx — PRODUCTION BATCH SETUP & OMRON ETHERNET/IP CONTROL
// =========================================================================

// -------------------------------------------------------------------------
// 1. IMPORTS & CONSTANTS
// -------------------------------------------------------------------------
import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { formatDateTime } from '../utils/dateTime'

const batchNumberPattern = /^[A-Za-z_]+$/
const PLC_API_BASE = 'http://127.0.0'

// -------------------------------------------------------------------------
// 2. COMPONENT DEFINITION & STATE HOOKS
// -------------------------------------------------------------------------
function BatchControl({
  batches,
  selectedBatch,
  parentMessage,
  onSelectBatch,
  onCreateBatch,
  onStartBatch,
  onStopBatch
}) {
  // 2A. Batch Creation Form State
  const [batchNumber, setBatchNumber] = useState('')
  const [productName, setProductName] = useState('')
  const [equipmentName, setEquipmentName] = useState('')
  const [equipmentId, setEquipmentId] = useState('')
  const [message, setMessage] = useState('')

  // 2B. Omron EtherNet/IP Driver #13 Telemetry & Connection State
  const [omronData, setOmronData] = useState({
    driverId: 13,
    plcIp: '192.168.0.2',
    plcPort: 44818,
    connected: false,
    selectedTagName: 'MACHINE_SPEED',
    selectedTagType: 'REAL',
    selectedTagValue: 0,
    availableTags: [{ name: 'MACHINE_SPEED', type: 'REAL' }],
    error: null
  })

  // 2C. PLC Input & Action Loading States
  const [plcIpInput, setPlcIpInput] = useState('192.168.0.2')
  const [plcPortInput, setPlcPortInput] = useState('44818')
  const [tagInput, setTagInput] = useState('MACHINE_SPEED')
  const [tagSetpoint, setTagSetpoint] = useState('')
  const [writingTag, setWritingTag] = useState(false)
  const [browsingTags, setBrowsingTags] = useState(false)

  // -----------------------------------------------------------------------
  // 3. LIVE POLLING EFFECT (FETCHES ACTIVE OMRON TAG EVERY 1 SECOND)
  // -----------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true

    const fetchOmronTags = async () => {
      try {
        const res = await fetch(`${PLC_API_BASE}/omron-tags`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (!isMounted) return
        setOmronData((prev) => ({
          ...prev,
          ...data,
          availableTags:
            Array.isArray(data.availableTags) && data.availableTags.length > 0
              ? data.availableTags
              : prev.availableTags
        }))
      } catch (err) {
        if (isMounted) {
          setOmronData((prev) => ({
            ...prev,
            connected: false,
            error: err.message || 'Fetch failed'
          }))
        }
      }
    }

    fetchOmronTags()
    const timer = setInterval(fetchOmronTags, 1000)
    return () => {
      isMounted = false
      clearInterval(timer)
    }
  }, [])

  // -----------------------------------------------------------------------
  // 4. OMRON PLC HANDLERS (CONFIG, BROWSE, SELECT & WRITE)
  // -----------------------------------------------------------------------

  // 4A. Update PLC Target IP & Port
  const handleUpdatePlcConfig = async () => {
    try {
      const res = await fetch(`${PLC_API_BASE}/omron-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plcIp: plcIpInput.trim(),
          plcPort: Number(plcPortInput)
        })
      })
      const data = await res.json()
      setMessage(
        res.ok
          ? `PLC target updated to ${data.plcIp}:${data.plcPort}`
          : data.error || 'Invalid IP or Port.'
      )
    } catch (err) {
      setMessage(`Unable to reach PLC service: ${err.message}`)
    }
  }

  // 4B. Refresh / Discover Network-Published PLC Tags
  const handleRefreshPlcTags = async () => {
    setBrowsingTags(true)
    try {
      const res = await fetch(`${PLC_API_BASE}/omron-browse`)
      const data = await res.json()
      if (res.ok && Array.isArray(data.tags)) {
        setOmronData((prev) => ({ ...prev, availableTags: data.tags }))
        setMessage(`Discovered ${data.tags.length} network-published PLC tag(s).`)
      } else {
        setMessage(data.error || 'Unable to browse tags from Omron PLC.')
      }
    } catch (err) {
      setMessage(`Unable to reach PLC service: ${err.message}`)
    } finally {
      setBrowsingTags(false)
    }
  }

  // 4C. Select & Load Specific PLC Tag into Active Polling
  const handleSelectPlcTag = async (rawName) => {
    const tagName = String(rawName || '').trim()
    if (!tagName) return

    try {
      const res = await fetch(`${PLC_API_BASE}/omron-select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagName })
      })
      const data = await res.json()
      if (res.ok) {
        setOmronData((prev) => ({
          ...prev,
          connected: true,
          selectedTagName: data.tagName,
          selectedTagType: data.typeName,
          selectedTagValue: data.value,
          error: null
        }))
        setTagInput(data.tagName)
        setTagSetpoint('')
        setMessage(`Loaded tag ${data.tagName} (${data.typeName}) = ${String(data.value)}`)
      } else {
        setMessage(data.error || `Could not read tag ${tagName}.`)
      }
    } catch (err) {
      setMessage(`Unable to reach PLC service: ${err.message}`)
    }
  }

  // 4D. Write New Setpoint Value to Active PLC Tag
  const handleWritePlcTag = async (event) => {
    event.preventDefault()
    if (tagSetpoint === '') return

    const activeName = omronData.selectedTagName || 'MACHINE_SPEED'
    const activeType = omronData.selectedTagType || 'REAL'
    const parsedValue =
      activeType === 'BOOL'
        ? tagSetpoint === '1' || tagSetpoint.toLowerCase() === 'true'
        : activeType === 'STRING'
          ? tagSetpoint
          : Number(tagSetpoint)

    if (activeType !== 'BOOL' && activeType !== 'STRING' && !Number.isFinite(parsedValue)) {
      setMessage(`Please enter a valid numeric value for ${activeType}.`)
      return
    }

    setWritingTag(true)
    try {
      const res = await fetch(`${PLC_API_BASE}/omron-write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tagName: activeName,
          typeName: activeType,
          value: parsedValue
        })
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || `Failed to write ${activeName} to Omron PLC.`)
      } else {
        setTagSetpoint('')
        setMessage(`${activeName} (${activeType}) updated to ${String(parsedValue)}.`)
      }
    } catch (err) {
      setMessage(`Unable to reach PLC service: ${err.message}`)
    } finally {
      setWritingTag(false)
    }
  }

  // -----------------------------------------------------------------------
  // 5. BATCH CREATION HANDLER & TAG OPTIONS MERGE
  // -----------------------------------------------------------------------
  const handleCreateBatch = (event) => {
    event.preventDefault()
    const batchId = batchNumber.trim()
    const fields = {
      id: batchId,
      product: productName.trim(),
      equipmentName: equipmentName.trim(),
      equipmentId: equipmentId.trim()
    }

    if (!batchNumberPattern.test(batchId)) {
      setMessage('Batch number may contain letters and underscores only.')
      return
    }
    if (!fields.product || !fields.equipmentName || !fields.equipmentId) {
      setMessage('Product and equipment name/ID are required.')
      return
    }

    const created = onCreateBatch(fields)
    if (!created) {
      setMessage('That batch number already exists. Batch numbers must be unique.')
      return
    }

    setBatchNumber('')
    setProductName('')
    setEquipmentName('')
    setEquipmentId('')
    setMessage(`Batch ${batchId} created and selected.`)
  }

  // Deduplicate default MACHINE_SPEED and discovered PLC tags
  const tagOptions = Array.from(
    new Map(
      [
        { name: 'MACHINE_SPEED', type: 'REAL' },
        ...(omronData.availableTags || [])
      ].map((t) => [t.name, t])
    ).values()
  )
  // -----------------------------------------------------------------------
  // 6. RENDER UI
  // -----------------------------------------------------------------------
  return (
    <section className="professional-screen batch-control-screen" aria-label="Batch control">
      {/* =================================================================== */}
      {/* SECTION 6A: SCREEN TITLE & CURRENT BATCH STATUS BADGE               */}
      {/* =================================================================== */}
      <header className="screen-heading">
        <div>
          <span className="screen-eyebrow">PRODUCTION CONTROL / BATCH SETUP</span>
          <h1>Batch control</h1>
          <p>Configure batch identity, assign equipment, and control batch state.</p>
        </div>
        <span className={`batch-state-badge is-${selectedBatch.status.toLowerCase()}`}>
          <i /> {selectedBatch.status}
        </span>
      </header>

      {/* =================================================================== */}
      {/* SECTION 6B: ACTIVE BATCH SUMMARY STRIP & START/STOP CONTROLS        */}
      {/* =================================================================== */}
      <div
        className="selected-batch-strip"
        style={{
          display: 'grid',
          gridTemplateColumns: '1.1fr 1.2fr 1.1fr 0.9fr auto',
          alignItems: 'center',
          gap: '14px'
        }}
      >
        <div>
          <span>ACTIVE BATCH</span>
          <strong>{selectedBatch.id}</strong>
        </div>
        <div>
          <span>PRODUCT</span>
          <strong>{selectedBatch.product}</strong>
        </div>
        <div>
          <span>EQUIPMENT</span>
          <strong>{selectedBatch.equipmentName}</strong>
        </div>
        <div>
          <span>EQUIPMENT ID</span>
          <strong>{selectedBatch.equipmentId}</strong>
        </div>
        <div className="batch-control-actions" style={{ justifySelf: 'end' }}>
          {selectedBatch.status !== 'Running' ? (
            <button
              className="batch-start-action"
              onClick={() => onStartBatch(selectedBatch.id)}
              style={{ height: '38px', minWidth: '132px' }}
              type="button"
            >
              START BATCH
            </button>
          ) : (
            <button
              className="batch-stop-action"
              onClick={() => onStopBatch(selectedBatch.id)}
              style={{ height: '38px', minWidth: '132px' }}
              type="button"
            >
              STOP BATCH
            </button>
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* SECTION 6C: OMRON ETHERNET/IP DRIVER #13 TELEMETRY & TAG WRITE BAR  */}
      {/* =================================================================== */}
      <div
        className="selected-batch-strip"
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1.5fr 0.8fr auto',
          alignItems: 'center',
          gap: '14px',
          marginTop: '10px'
        }}
      >
        {/* Column 1: Connection Status & IP/Port Configuration */}
        <div>
          <span>
            OMRON EIP #13 ({omronData.plcIp}:{omronData.plcPort || 44818})
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
            <span className={`record-status ${omronData.connected ? 'is-running' : 'is-stopped'}`}>
              {omronData.connected ? 'CONNECTED' : 'OFFLINE'}
            </span>
            <input
              aria-label="Omron PLC IP"
              onChange={(e) => setPlcIpInput(e.target.value)}
              placeholder="IP"
              style={{ width: '105px', height: '28px', padding: '0 6px' }}
              type="text"
              value={plcIpInput}
            />
            <input
              aria-label="Omron PLC Port"
              onChange={(e) => setPlcPortInput(e.target.value)}
              placeholder="Port"
              style={{ width: '64px', height: '28px', padding: '0 6px' }}
              type="number"
              value={plcPortInput}
            />
            <button
              className="table-action-neutral"
              onClick={handleUpdatePlcConfig}
              style={{ height: '28px', padding: '0 8px' }}
              type="button"
            >
              SET
            </button>
          </div>
          {!omronData.connected && omronData.error && (
            <small
              style={{
                display: 'block',
                fontSize: '0.72rem',
                color: '#dc2626',
                marginTop: '2px'
              }}
            >
              {omronData.error}
            </small>
          )}
        </div>

        {/* Column 2: Tag Dropdown / Custom Tag Input & Discovery Buttons */}
        <div>
          <span>SELECT OR TYPE PLC TAG ({tagOptions.length} AVAILABLE)</span>
          <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
            <input
              aria-label="Select or Type Omron PLC Tag"
              list="omron-tag-list"
              onChange={(e) => {
                const val = e.target.value
                setTagInput(val)
                if (tagOptions.some((t) => t.name === val.trim())) {
                  handleSelectPlcTag(val.trim())
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSelectPlcTag(tagInput)
                }
              }}
              placeholder="Select or type tag name..."
              style={{ height: '34px', flex: 1, minWidth: '150px', padding: '0 8px' }}
              type="text"
              value={tagInput}
            />
            <datalist id="omron-tag-list">
              {tagOptions.map((tag) => (
                <option key={tag.name} value={tag.name}>
                  {tag.name} ({tag.type})
                </option>
              ))}
            </datalist>
            <button
              className="table-action-neutral"
              disabled={!tagInput.trim()}
              onClick={() => handleSelectPlcTag(tagInput)}
              style={{ height: '34px', whiteSpace: 'nowrap' }}
              type="button"
            >
              LOAD TAG
            </button>
            <button
              className="table-action-neutral"
              disabled={browsingTags}
              onClick={handleRefreshPlcTags}
              style={{ height: '34px', whiteSpace: 'nowrap' }}
              title="Discover Network-Published tags from Omron PLC"
              type="button"
            >
              {browsingTags ? '...' : 'REFRESH TAGS'}
            </button>
          </div>
        </div>

        {/* Column 3: Active Tag Live Value */}
        <div>
          <span>
            {omronData.selectedTagName
              ? `${omronData.selectedTagName} (${omronData.selectedTagType || 'REAL'})`
              : 'LIVE VALUE'}
          </span>
          <strong style={{ fontSize: '1.15rem' }}>
            {String(omronData.selectedTagValue ?? 0)}
          </strong>
        </div>

        {/* Column 4: Write Setpoint Form */}
        <form
          onSubmit={handleWritePlcTag}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            justifySelf: 'end'
          }}
        >
          <input
            aria-label="Write PLC Tag Value"
            disabled={!omronData.connected || !omronData.selectedTagName}
            onChange={(e) => setTagSetpoint(e.target.value)}
            placeholder={`Set ${omronData.selectedTagType || 'REAL'}`}
            style={{ width: '130px', height: '34px', padding: '0 10px' }}
            type="text"
            value={tagSetpoint}
          />
          <button
            className="primary-screen-action"
            disabled={
              !omronData.connected ||
              !omronData.selectedTagName ||
              writingTag ||
              tagSetpoint === ''
            }
            style={{ height: '34px', whiteSpace: 'nowrap' }}
            type="submit"
          >
            {writingTag ? 'WRITING...' : 'WRITE TAG'}
          </button>
        </form>
      </div>

      {/* =================================================================== */}
      {/* SECTION 6D: CREATE NEW PRODUCTION BATCH FORM                        */}
      {/* =================================================================== */}
      <section className="batch-create-section" aria-labelledby="create-batch-title">
        <div className="subsection-heading">
          <div>
            <span>NEW PRODUCTION RECORD</span>
            <h2 id="create-batch-title">Create batch</h2>
          </div>
          <span>Letters and underscores only</span>
        </div>
        <form
          className="batch-create-form"
          onSubmit={handleCreateBatch}
          style={{
            display: 'grid',
            gridTemplateColumns: '1.1fr 1.2fr 1.1fr 0.9fr auto',
            alignItems: 'end',
            gap: '10px'
          }}
        >
          <label>
            Batch number
            <input
              autoComplete="off"
              onChange={(event) => setBatchNumber(event.target.value)}
              placeholder="e.g. VIAL_BATCH_A"
              required
              style={{ width: '100%', height: '36px' }}
              value={batchNumber}
            />
          </label>
          <label>
            Product name
            <input
              onChange={(event) => setProductName(event.target.value)}
              placeholder="Product name"
              required
              style={{ width: '100%', height: '36px' }}
              value={productName}
            />
          </label>
                   <label>
            Equipment name
            <input
              onChange={(event) => setEquipmentName(event.target.value)}
              placeholder="Filling line"
              required
              style={{ width: '100%', height: '36px' }}
              value={equipmentName}
            />
          </label>
          <label>
            Equipment ID
            <input
              onChange={(event) => setEquipmentId(event.target.value)}
              placeholder="LINE_A_01"
              required
              style={{ width: '100%', height: '36px' }}
              value={equipmentId}
            />
          </label>
          <button
            className="primary-screen-action"
            style={{ height: '36px', whiteSpace: 'nowrap' }}
            type="submit"
          >
            CREATE BATCH
          </button>
        </form>
        {(message || parentMessage) && (
          <p className="batch-feedback" role="status">
            {message || parentMessage}
          </p>
        )}
      </section>

      {/* =================================================================== */}
      {/* SECTION 6E: AVAILABLE BATCHES REGISTER TABLE                        */}
      {/* =================================================================== */}
      <section className="batch-register-section" aria-labelledby="batch-register-title">
        <div className="subsection-heading">
          <div>
            <span>REGISTER</span>
            <h2 id="batch-register-title">Available batches</h2>
          </div>
          <span>{batches.length} records</span>
        </div>
        <div className="professional-table-wrap batch-register-table-wrap">
          <table className="professional-table batch-register-table">
            <thead>
              <tr>
                <th>Batch number</th>
                <th>Product name</th>
                <th>Equipment name</th>
                <th>Equipment ID</th>
                <th>Status</th>
                <th>Start date/time</th>
                <th>Stop date/time</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr
                  className={batch.id === selectedBatch.id ? 'is-selected-batch' : ''}
                  key={batch.id}
                >
                  <td>{batch.id}</td>
                  <td>{batch.product}</td>
                  <td>{batch.equipmentName}</td>
                  <td>{batch.equipmentId}</td>
                  <td>
                    <span className={`record-status is-${batch.status.toLowerCase()}`}>
                      {batch.status}
                    </span>
                  </td>
                  <td>{batch.startedAt ? formatDateTime(batch.startedAt) : '-'}</td>
                  <td>{batch.stoppedAt ? formatDateTime(batch.stoppedAt) : '-'}</td>
                  <td>
                    <button
                      className="table-action-neutral"
                      onClick={() => onSelectBatch(batch.id)}
                      type="button"
                    >
                      SELECT
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  )
}

// -------------------------------------------------------------------------
// 7. PROP TYPES & DEFAULT EXPORT
// -------------------------------------------------------------------------
BatchControl.propTypes = {
  batches: PropTypes.arrayOf(PropTypes.object).isRequired,
  selectedBatch: PropTypes.object.isRequired,
  parentMessage: PropTypes.string.isRequired,
  onSelectBatch: PropTypes.func.isRequired,
  onCreateBatch: PropTypes.func.isRequired,
  onStartBatch: PropTypes.func.isRequired,
  onStopBatch: PropTypes.func.isRequired
}

export default BatchControl

