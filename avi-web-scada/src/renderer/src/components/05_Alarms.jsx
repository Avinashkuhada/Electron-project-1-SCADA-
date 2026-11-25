import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { formatDateTime, formatDuration } from '../utils/dateTime'

function Alarms({ alarms, onAcknowledge, onDeactivate, canOperate = true }) {
  const [now, setNow] = useState(0)
  const [filter, setFilter] = useState('All')

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const visibleAlarms = alarms.filter((alarm) => filter === 'All' || alarm.severity === filter)
  const activeCount = alarms.filter((alarm) => !alarm.deactivatedAt).length
  const unacknowledgedCount = alarms.filter((alarm) => !alarm.acknowledgedAt).length

  return (
    <section className="professional-screen alarms-screen" aria-label="Alarm console">
      <header className="screen-heading">
        <div>
          <span className="screen-eyebrow">ALARM MONITOR / BATCH OPERATIONS</span>
          <h1>Alarm console</h1>
          <p>Review, acknowledge, and deactivate process alarms.</p>
        </div>
        <label className="alarm-filter">
          Severity
          <select onChange={(event) => setFilter(event.target.value)} value={filter}>
            <option>All</option>
            <option>Critical</option>
            <option>Warning</option>
            <option>Info</option>
          </select>
        </label>
      </header>

      <div className="alarm-kpis">
        <article>
          <span>Active alarms</span>
          <strong>{activeCount}</strong>
        </article>
        <article>
          <span>Awaiting acknowledgement</span>
          <strong className={unacknowledgedCount ? 'alarm-kpi-warning' : ''}>
            {unacknowledgedCount}
          </strong>
        </article>
        <article>
          <span>Displayed</span>
          <strong>{visibleAlarms.length}</strong>
        </article>
      </div>

      <div className="professional-table-wrap">
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
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {visibleAlarms.map((alarm) => {
              const isLocked = Boolean(alarm.deactivatedAt || alarm.isLocked)
              const lockedDuration = formatDuration(
                alarm.activeAt,
                alarm.deactivatedAt || now || alarm.activeAt
              )

              return (
                <tr
                  className={!alarm.deactivatedAt ? 'alarm-table-row is-active' : ''}
                  key={alarm.id}
                >
                  <td className="alarm-id-cell">{alarm.id}</td>
                  <td>
                    <span className={`severity-label severity-${alarm.severity.toLowerCase()}`}>
                      {alarm.severity}
                    </span>
                  </td>
                  <td>
                    <strong>{alarm.source}</strong>
                    <small>{alarm.message}</small>
                  </td>
                  <td>{formatDateTime(alarm.activeAt)}</td>
                  <td>
                    {alarm.deactivatedAt ? (
                      formatDateTime(alarm.deactivatedAt)
                    ) : (
                      <span className="muted-value">Active</span>
                    )}
                  </td>
                  <td>
                    <strong>
                      {lockedDuration} {isLocked ? '🔒' : ''}
                    </strong>
                  </td>
                  <td>
                    {alarm.acknowledgedAt ? (
                      formatDateTime(alarm.acknowledgedAt)
                    ) : (
                      <span className="muted-value">Pending</span>
                    )}
                  </td>
                  <td>{alarm.acknowledgedBy || <span className="muted-value">-</span>}</td>
                  <td className="alarm-actions-cell">
                    {!alarm.acknowledgedAt && (
                      <button
                        className="alarm-table-action"
                        disabled={!canOperate}
                        onClick={() => onAcknowledge(alarm.id)}
                        title={!canOperate ? 'Locked: Requires Operate permission' : undefined}
                        type="button"
                      >
                        {!canOperate ? '🔒 ' : ''}ACKNOWLEDGE
                      </button>
                    )}
                    {!alarm.deactivatedAt && (
                      <button
                        className="alarm-table-action is-deactivate"
                        disabled={!canOperate}
                        onClick={() => onDeactivate(alarm.id)}
                        title={!canOperate ? 'Locked: Requires Operate permission' : undefined}
                        type="button"
                      >
                        {!canOperate ? '🔒 ' : ''}DEACTIVATE
                      </button>
                    )}
                    {alarm.acknowledgedAt && alarm.deactivatedAt && (
                      <span className="alarm-closed-label">CLOSED 🔒</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {visibleAlarms.length === 0 && (
          <p className="table-empty-state">No alarms match this filter.</p>
        )}
      </div>

      <p className="screen-disclaimer">
        Connected to SQL Server (AVI_IRS_DATA · dbo.Alarms). Deactivated alarm durations are permanently locked.
      </p>
    </section>
  )
}

Alarms.propTypes = {
  alarms: PropTypes.arrayOf(PropTypes.object).isRequired,
  onAcknowledge: PropTypes.func.isRequired,
  onDeactivate: PropTypes.func.isRequired,
  canOperate: PropTypes.bool
}

export default Alarms
