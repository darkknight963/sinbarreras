import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

export class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; message: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || 'Error inesperado' };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary]', error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16, padding: 32 }}>
          <p style={{ fontWeight: 600, fontSize: 18 }}>Algo salió mal</p>
          <p style={{ color: '#64748b', textAlign: 'center', maxWidth: 400 }}>{this.state.message}</p>
          <button onClick={() => window.location.reload()} style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', borderRadius: 8, border: 'none', cursor: 'pointer' }}>
            Recargar página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
