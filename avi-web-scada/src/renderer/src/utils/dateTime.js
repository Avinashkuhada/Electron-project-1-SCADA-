const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23'
})

export function formatDateTime(value) {
  if (!value) return '-'

  let date
  if (value instanceof Date) {
    date = value
  } else if (typeof value === 'string' && /^\d{2}:\d{2}:\d{2}$/.test(value)) {
    const [hour, minute, second] = value.split(':').map(Number)
    date = new Date()
    date.setHours(hour, minute, second, 0)
  } else {
    date = new Date(value)
  }

  if (Number.isNaN(date.getTime())) return '-'

  const parts = Object.fromEntries(
    dateTimeFormatter.formatToParts(date).map(({ type, value: part }) => [type, part])
  )
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`
}

export function formatDuration(start, end = Date.now()) {
  if (!start) return '-'

  const elapsedSeconds = Math.max(
    0,
    Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000)
  )
  const days = Math.floor(elapsedSeconds / 86400)
  const hours = Math.floor((elapsedSeconds % 86400) / 3600)
  const minutes = Math.floor((elapsedSeconds % 3600) / 60)
  const seconds = elapsedSeconds % 60
  const time = [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')

  return days ? `${days}d ${time}` : time
}
