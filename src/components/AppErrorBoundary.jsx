import { Component } from 'react'

const STORAGE_KEYS = [
  'listenwell-theme',
  'listenwell-settings-position',
  'listenwell-presets',
  'listenwell-aurora-intensity',
  'listenwell-glow-softness',
  'listenwell-blur-amount',
]

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, errorMessage: '' }
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : 'Unknown runtime error',
    }
  }

  componentDidCatch(error, info) {
    console.error('ListenWell runtime error:', error, info)
  }

  handleReset = () => {
    if (typeof window !== 'undefined') {
      STORAGE_KEYS.forEach((key) => {
        window.localStorage.removeItem(key)
      })
      window.location.reload()
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen bg-[#050509] text-white flex items-center justify-center px-6">
          <section className="max-w-xl w-full rounded-2xl border border-white/10 bg-black/60 p-6 sm:p-8">
            <h1 className="text-2xl font-semibold">ListenWell hit a runtime error</h1>
            <p className="mt-3 text-sm text-white/75">
              This usually happens when stale local changes or saved settings conflict with the latest app code.
            </p>
            <pre className="mt-4 rounded-lg bg-white/5 border border-white/10 p-3 text-xs text-red-300 overflow-auto">
              {this.state.errorMessage}
            </pre>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 transition"
              >
                Reset saved settings + reload
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-lg border border-white/20 hover:bg-white/5 transition"
              >
                Reload only
              </button>
            </div>
          </section>
        </main>
      )
    }

    return this.props.children
  }
}

export default AppErrorBoundary
