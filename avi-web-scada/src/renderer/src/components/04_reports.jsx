import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { formatDateTime, formatDuration } from '../utils/dateTime'

const reportTypes = [
  { id: 'intervention', label: 'Intervention Activity' },
  { id: 'audit', label: 'Audit Report' },
  { id: 'alarm', label: 'Alarm Report' }
]

function Reports({ batch, interventions, auditEntries, alarms, users, onExportReport }) {
  const [reportType, setReportType] = useState('intervention')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [now, setNow] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const visibleInterventions = interventions.filter((item) => {
    const matchesStatus = statusFilter === 'All' || item.status === statusFilter
    const searchText =
      `${item.code} ${item.asset} ${item.activity} ${item.operator} ${item.category}`.toLowerCase()
    return matchesStatus && searchText.includes(search.trim().toLowerCase())
  })

  const getFullName = (userId) =>
    users.find((user) => user.loginId === userId)?.name || userId || '-'
  const reportTitle = reportTypes.find((type) => type.id === reportType)?.label || 'Reports'

  return (
    <section className="professional-screen reports-screen" aria-label="Batch reports">
      <header className="screen-heading">
        <div>
          <span className="screen-eyebrow">BATCH REPORTS / {batch.id}</span>
          <h1>{reportTitle}</h1>
          <p>{batch.product}</p>
        </div>
        <button
          className="primary-screen-action"
          onClick={() => onExportReport(reportType)}
          type="button"
        >
          EXPORT {reportType.toUpperCase()} CSV
        </button>
      </header>

      <nav className="report-type-tabs" role="tablist" aria-label="Report type">
        {reportTypes.map((type) => (
          <button
            aria-selected={reportType === type.id}
            className={reportType === type.id ? 'report-type-tab is-active' : 'report-type-tab'}
            key={type.id}
            onClick={() => {
              setReportType(type.id)
              setSearch('')
              setStatusFilter('All')
            }}
            role="tab"
            type="button"
          >
            {type.label}
          </button>
        ))}
      </nav>

      {reportType === 'intervention' && (
        <>
          <div className="report-kpis" aria-label="Batch intervention summary">
            <article>
              <span>Total activities</span>
              <strong>{interventions.length}</strong>
            </article>
            <article>
              <span>Completed</span>
              <strong>{interventions.filter((item) => item.status === 'Complete').length}</strong>
            </article>
            <article>
              <span>Running</span>
              <strong>{interventions.filter((item) => item.status === 'Running').length}</strong>
            </article>
            <article>
              <span>Pending</span>
              <strong>{interventions.filter((item) => item.status === 'Pending').length}</strong>
            </article>
          </div>
          <div className="report-tools">
            <label className="report-search">
              <span>Search records</span>
              <input
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Code, asset, activity, user"
                value={search}
              />
            </label>
            <label className="report-status-filter">
              <span>Status</span>
              <select
                onChange={(event) => setStatusFilter(event.target.value)}
                value={statusFilter}
              >
                <option>All</option>
                <option>Pending</option>
                <option>Running</option>
                <option>Complete</option>
              </select>
            </label>
            <span className="report-result-count">{visibleInterventions.length} records</span>
          </div>
          <div className="professional-table-wrap report-table-area">
            <table className="professional-table report-record-table">
              <thead>
                <tr>
                  <th>Activity code</th>
                  <th>Asset</th>
                  <th>Action / Activity</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Date and time</th>
                  <th>User ID</th>
                </tr>
              </thead>
              <tbody>
                {visibleInterventions.map((item) => (
                  <tr key={item.id}>
                    <td className="report-code">{item.code}</td>
                    <td>{item.asset}</td>
                    <td>{item.activity}</td>
                    <td>
                      <span className={`record-type is-${item.category.toLowerCase()}`}>
                        {item.category}
                      </span>
                    </td>
                    <td>
                      <span className={`record-status is-${item.status.toLowerCase()}`}>
                        {item.status}
                      </span>
                    </td>
                    <td>{item.time ? formatDateTime(item.time) : '-'}</td>
                    <td>{item.operator || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visibleInterventions.length && (
              <p className="table-empty-state">No activities match these filters.</p>
            )}
          </div>
        </>
      )}

      {reportType === 'audit' && (
        <div className="professional-table-wrap report-table-area">
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
              {auditEntries.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDateTime(entry.time)}</td>
                  <td>{entry.action}</td>
                  <td>{entry.details}</td>
                  <td>{entry.user}</td>
                  <td>{getFullName(entry.user)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!auditEntries.length && (
            <p className="table-empty-state">No audit records for this batch.</p>
          )}
        </div>
      )}

      {reportType === 'alarm' && (
        <div className="professional-table-wrap report-table-area">
          <table className="professional-table alarm-record-table">
            <thead>
              <tr>
                <th>Alarm ID</th>
                <th>Severity</th>
                <th>Source / Description</th>
                <th>Active date and time</th>
                <th>Deactive date and time</th>
                <th>Duration</th>
                <th>Acknowledge time</th>
                <th>Acknowledge user ID</th>
              </tr>
            </thead>
            <tbody>
              {alarms.map((alarm) => (
                <tr key={alarm.id}>
                  <td>{alarm.id}</td>
                  <td>{alarm.severity}</td>
                  <td>
                    <strong>{alarm.source}</strong>
                    <small>{alarm.message}</small>
                  </td>
                  <td>{formatDateTime(alarm.activeAt)}</td>
                  <td>{alarm.deactivatedAt ? formatDateTime(alarm.deactivatedAt) : 'Active'}</td>
                  <td>
                    {formatDuration(alarm.activeAt, alarm.deactivatedAt || now || alarm.activeAt)}
                  </td>
                  <td>{alarm.acknowledgedAt ? formatDateTime(alarm.acknowledgedAt) : 'Pending'}</td>
                  <td>{alarm.acknowledgedBy || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!alarms.length && <p className="table-empty-state">No alarm records for this batch.</p>}
        </div>
      )}

      <p className="screen-disclaimer">
        Demo report data is held in memory and is not a validated electronic batch record.
      </p>
    </section>
  )
}

Reports.propTypes = {
  batch: PropTypes.shape({ id: PropTypes.string.isRequired, product: PropTypes.string.isRequired })
    .isRequired,
  interventions: PropTypes.arrayOf(PropTypes.object).isRequired,
  auditEntries: PropTypes.arrayOf(PropTypes.object).isRequired,
  alarms: PropTypes.arrayOf(PropTypes.object).isRequired,
  users: PropTypes.arrayOf(PropTypes.object).isRequired,
  onExportReport: PropTypes.func.isRequired
}

export default Reports
