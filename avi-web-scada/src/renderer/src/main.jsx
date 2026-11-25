import './assets/main.css'

import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import PropTypes from 'prop-types'
import App from './App'

window.addEventListener('error', (event) => {
  console.error('[renderer] Uncaught error:', event.error ?? event.message)
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('[renderer] Unhandled promise rejection:', event.reason)
})

class RenderErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[renderer] React rendering failed:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <main role="alert">
          <h1>Application rendering failed</h1>
          <pre>{this.state.error.stack || this.state.error.message}</pre>
        </main>
      )
    }

    return this.props.children
  }
}

RenderErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired
}

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Renderer root element #root was not found')
}

const root = createRoot(rootElement)
root.render(
  <StrictMode>
    <RenderErrorBoundary>
      <App />
    </RenderErrorBoundary>
  </StrictMode>
)

if (import.meta.hot) {
  import.meta.hot.dispose(() => root.unmount())
}
