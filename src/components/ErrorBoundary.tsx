import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Icon } from './Icon.tsx'

interface Props {
  /** Shown in the message, e.g. "Scan". */
  section: string
  children: ReactNode
}

/** Keeps one broken section (e.g. an unexpected scan result) from blanking the whole app. */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Stays on the device: there is no error reporting service.
    console.error(`[QR Studio] ${this.props.section} crashed`, error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="card stack" role="alert">
        <p className="status status-bad">
          <Icon name="alert" /> Something went wrong in {this.props.section}. Your other sections are fine.
        </p>
        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={() => this.setState({ failed: false })}>
            Try again
          </button>
        </div>
      </div>
    )
  }
}
