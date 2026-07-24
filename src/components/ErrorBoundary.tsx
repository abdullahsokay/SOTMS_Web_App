import { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global error boundary.
 *
 * Wrapping the provider/app tree in this component means a single render-time
 * throw anywhere in the monitoring dashboard degrades to a recoverable panel
 * instead of white-screening the entire app. React only catches render-phase
 * errors here — async/event-handler errors still need their own try/catch.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught render error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            backgroundColor: '#07121A',
            fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: '480px',
              width: '100%',
              textAlign: 'center',
              backgroundColor: '#0C1E2C',
              border: '1px solid rgba(0, 229, 255, 0.3)',
              borderRadius: '16px',
              padding: '40px 32px',
              boxShadow: '0 0 30px rgba(0, 229, 255, 0.15)',
            }}
          >
            <div
              style={{
                fontSize: '48px',
                lineHeight: 1,
                marginBottom: '16px',
              }}
              aria-hidden="true"
            >
              ⚠️
            </div>
            <h1
              style={{
                color: '#00E5FF',
                fontSize: '22px',
                fontWeight: 600,
                margin: '0 0 12px',
              }}
            >
              Something went wrong
            </h1>
            <p
              style={{
                color: '#D9DCE1',
                opacity: 0.75,
                fontSize: '14px',
                margin: '0 0 20px',
              }}
            >
              An unexpected error interrupted the dashboard. You can try reloading
              to recover.
            </p>
            {this.state.error?.message && (
              <pre
                style={{
                  textAlign: 'left',
                  color: '#FF4D4D',
                  backgroundColor: '#07121A',
                  border: '1px solid rgba(255, 77, 77, 0.3)',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  fontSize: '12px',
                  lineHeight: 1.5,
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  margin: '0 0 24px',
                }}
              >
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={this.handleReload}
              style={{
                cursor: 'pointer',
                color: '#07121A',
                fontWeight: 600,
                fontSize: '14px',
                padding: '10px 28px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #009FFD, #00E5FF)',
                boxShadow: '0 0 20px rgba(0, 229, 255, 0.35)',
              }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
