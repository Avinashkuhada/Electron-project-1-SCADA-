import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { formatDateTime } from '../utils/dateTime'

function Audit({ batchId, auditEntries, users, canExport = true, onAuditExported }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [liveEntries, setLiveEntries] = useState(auditEntries)

  useEffect(() => {
    setLiveEntries(auditEntries)
  }, [auditEntries])

  useEffect(() => {
    fetch('http://' + '127.0.0.1' + ':5000/api/scada-data')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.audit)) {
          setLiveEntries(
            data.audit.map((row) => ({
              id: `audit-${row.AuditId}`,
              batchId: row.BatchId,
              time: row.EventTime ? String(row.EventTime).replace(/Z$/i, '') : row.EventTime,
              user: row.UserId,
              completeName: row.CompleteName || row.UserId,
              action: row.Action,
              details: row.Details
            }))
          )
        }
      })
      .catch(() => {})
  }, [batchId])

  const getCompleteName = (entry) =>
    entry.completeName ||
    users.find((u) => u.loginId === entry.user)?.name ||
    entry.user

  const visibleByBatch = liveEntries.filter(
    (entry) =>
      entry.batchId === batchId ||
      entry.batchId === 'SYSTEM' ||
      entry.action.startsWith('Operator') ||
      entry.action.startsWith('User') ||
      entry.action.startsWith('Group') ||
      entry.action.startsWith('Failed login')
  )

  const filteredEntries = visibleByBatch.filter((entry) => {
    const q = searchTerm.toLowerCase()
    const fullName = getCompleteName(entry)
    return (
      entry.action.toLowerCase().includes(q) ||
      entry.details.toLowerCase().includes(q) ||
      entry.user.toLowerCase().includes(q) ||
      fullName.toLowerCase().includes(q)
    )
  })

  const handleExportAuditCsv = () => {
    if (!canExport) {
      alert('🔒 Locked: Your group does not have Operate/Approve permission to export Audit Trail.')
      return
    }

    const reportRows = [
      ['Date and time', 'Action / Activity', 'Description', 'User ID', 'Complete Name'],
      ...filteredEntries.map((entry) => [
        formatDateTime(entry.time),
        entry.action,
        entry.details,
        entry.user,
        getCompleteName(entry)
      ])
    ]

    const csv = reportRows
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\r\n')

    const reportUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = reportUrl
    link.download = `${batchId}-audit-report.csv`
    link.click()
    URL.revokeObjectURL(reportUrl)

    if (onAuditExported) {
      onAuditExported('Report exported', `${batchId} · audit report`)
    }
  }

  return (
    <section className="professional-screen audit-screen" aria-label="Audit trail">
      <header className="screen-heading">
        <div>
          <span className="screen-eyebrow">EVENT HISTORY / {batchId}</span>
          <h1>Audit trail</h1>
          <p>Chronological operator activity log (AVI_IRS_DATA » dbo.AuditTrail).</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span className="status-chip is-running">
            <i /> {filteredEntries.length} EVENTS
          </span>
          <button
            className="primary-screen-action"
            disabled={!canExport}
            onClick={handleExportAuditCsv}
            title={!canExport ? 'Locked: Requires Operate or Approve permission' : 'Export Audit CSV'}
            type="button"
          >
            {!canExport ? '🔒 ' : ''}EXPORT CSV
          </button>
        </div>
      </header>

      <div className="asset-toolbar" style={{ marginBottom: '12px' }}>
        <label>
          Search Audit Log
          <input
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter by action, description, or operator..."
            type="text"
            value={searchTerm}
          />
        </label>
      </div>

      <div className="professional-table-wrap">
        <table className="professional-table audit-record-table">
          <thead>
            <tr>
              <th>Date and time</th>
              <th>Action / Activity</th>
              <th>Description</th>
              <th>User ID</th>
              <th>Complete Name</th>
            </tr>
          </thead>
          <tbody>
            {filteredEntries.map((entry) => (
              <tr key={entry.id}>
                <td>{formatDateTime(entry.time)}</td>
                <td>
                  <strong>{entry.action}</strong>
                </td>
                <td>{entry.details}</td>
                <td>{entry.user}</td>
                <td>{getCompleteName(entry)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredEntries.length === 0 && (
          <p className="table-empty-state">No audit events recorded.</p>
        )}
      </div>

      <p className="screen-disclaimer">
        Connected: AVI_IRS_DATA » dbo.AuditTrail. Records are timestamped and locked.
      </p>
    </section>
  )
}

Audit.propTypes = {
  batchId: PropTypes.string.isRequired,
  auditEntries: PropTypes.arrayOf(PropTypes.object).isRequired,
  users: PropTypes.arrayOf(PropTypes.object).isRequired,
  canExport: PropTypes.bool,
  onAuditExported: PropTypes.func
}

export default Audit
