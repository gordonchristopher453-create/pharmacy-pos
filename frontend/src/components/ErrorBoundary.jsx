import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error.message, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '2rem', textAlign: 'center', color: '#ef4444',
          background: '#1a1a2e', minHeight: '200px', borderRadius: '8px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️</div>
          <h3 style={{ marginBottom: '0.5rem', color: '#f87171' }}>Something went wrong</h3>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem', maxWidth: '400px' }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: '1rem', padding: '0.5rem 1.5rem',
              background: '#10b981', color: 'white',
              border: 'none', borderRadius: '6px', cursor: 'pointer'
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
