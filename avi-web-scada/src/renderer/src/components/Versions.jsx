import { useState } from 'react'

function Versions() {
  const [versions] = useState(() => window.electron?.process?.versions)

  return (
    <ul className="versions">
      {versions ? (
        <>
          <li className="electron-version">Electron v{versions.electron}</li>
          <li className="chrome-version">Chromium v{versions.chrome}</li>
          <li className="node-version">Node v{versions.node}</li>
        </>
      ) : (
        <li className="browser-preview">Browser preview</li>
      )}
    </ul>
  )
}

export default Versions
