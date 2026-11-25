import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { formatDateTime } from '../utils/dateTime'

function Header({ alarms }) {
  const [messageIndex, setMessageIndex] = useState(0)
  const activeAlarms = alarms.filter((alarm) => !alarm.deactivatedAt)
  const currentAlarm = activeAlarms[messageIndex % Math.max(activeAlarms.length, 1)]

  useEffect(() => {
    if (activeAlarms.length < 2) return undefined

    const timer = window.setInterval(() => {
      setMessageIndex((currentIndex) => (currentIndex + 1) % activeAlarms.length)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [activeAlarms.length])

  return (
    <header className="irs-header">
      <div className="irs-header-title">
        <strong>SCADA IRS</strong>
        <span>INTERVENTION RECORD SYSTEM</span>
      </div>
      <div className="header-live-alarm" aria-live="polite" aria-label="Current live alarms">
        <span className="header-alarm-label">LIVE ALARM</span>
        <span
          className={currentAlarm ? 'header-alarm-light is-active' : 'header-alarm-light'}
          aria-hidden="true"
        />
        <div className="header-alarm-window">
          {currentAlarm ? (
            <p className="header-alarm-message" key={currentAlarm.id}>
              <strong>{currentAlarm.id}</strong>
              <span>{currentAlarm.severity.toUpperCase()}</span>
              <span>
                {currentAlarm.source}: {currentAlarm.message}
              </span>
              <time>{formatDateTime(currentAlarm.activeAt)}</time>
            </p>
          ) : (
            <p className="header-alarm-message is-clear">NO ACTIVE ALARMS</p>
          )}
        </div>
      </div>
    </header>
  )
}

Header.propTypes = {
  alarms: PropTypes.arrayOf(PropTypes.object).isRequired
}

export default Header
