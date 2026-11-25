import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { formatDateTime } from '../utils/dateTime'

const initialClock = new Date().toISOString()

function Footer({ userId, batchNumber }) {
  const [clock, setClock] = useState(initialClock)

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date().toISOString()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <footer className="irs-footer">
      <span className="footer-date">
        <strong>DATE / TIME</strong>
        <time>{formatDateTime(clock)}</time>
      </span>
      <span className="footer-user">
        <strong>User:</strong> {userId}
      </span>
      <span className="footer-batch">
        <strong>Batch:</strong> {batchNumber}
      </span>
      <span className="footer-state">
        <i /> WORKSTATION READY
      </span>
    </footer>
  )
}

Footer.propTypes = {
  userId: PropTypes.string.isRequired,
  batchNumber: PropTypes.string.isRequired
}

export default Footer
