// src/components/ui/ErrorBoundary.tsx
// Si una vista falla al dibujarse, muestra el error en vez de dejar la pantalla en blanco.
import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode; name?: string };
type State = { error: Error | null; componentStack: string };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`❌ [${this.props.name || 'Vista'}] Error al mostrar la vista:`, error, info.componentStack);
    this.setState({ componentStack: info.componentStack || '' });
  }

  private reset = () => this.setState({ error: null, componentStack: '' });

  private copy = () => {
    const { error, componentStack } = this.state;
    const text = `${this.props.name || 'Vista'}: ${error?.message}\n\n${error?.stack || ''}\n\nComponentes:${componentStack}`;
    navigator.clipboard?.writeText(text).catch(() => { /* sin permiso de portapapeles */ });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="mx-auto mt-10 max-w-xl rounded-xl border border-red-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-bold text-red-700">Ocurrió un error al mostrar {this.props.name ? `"${this.props.name}"` : 'esta vista'}</p>
        <p className="mt-2 break-words rounded-lg bg-red-50 p-3 font-mono text-xs text-red-700">{error.message}</p>
        <p className="mt-3 text-xs text-slate-500">Puedes reintentar. Si se repite, copia el error y envíalo a soporte.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={this.reset} className="rounded-lg bg-navy-600 px-4 py-2 text-xs font-bold text-white hover:bg-navy-700">Reintentar</button>
          <button onClick={this.copy} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">Copiar error</button>
        </div>
      </div>
    );
  }
}
