// src/components/OrdersModule.tsx
import { useState } from 'react';
import type { ActiveView } from '../App';

interface Props {
  onNavigate: (v: ActiveView) => void;
}

export default function OrdersModule({ onNavigate }: Props) {
  const [filter, setFilter] = useState<'todos' | 'carga' | 'cotizacion'>('todos');

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">📧 Pedidos / Correo</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Gestiona pedidos y accede al correo empresarial
          </p>
        </div>
      </div>

      {/* Tarjeta de acceso al módulo de correo */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
        <div className="flex items-start gap-4">
          <svg className="w-10 h-10 flex-shrink-0" viewBox="0 0 24 24" fill="#0078D4">
            <path d="M11.4 2.8c-1.2 0-2.2.8-2.5 1.9L5.2 18.9c-.1.5 0 1 .3 1.4.3.4.8.7 1.3.7h10.4c.5 0 1-.3 1.3-.7.3-.4.4-.9.3-1.4L15.1 4.7c-.3-1.1-1.3-1.9-2.5-1.9h-1.2z"/>
            <path d="M12.1 7.4c-.9 0-1.6.6-1.8 1.5l-2.5 11.7c-.1.3 0 .6.2.8.2.2.4.3.7.3h5.7c.3 0 .5-.1.7-.3.2-.2.3-.5.2-.8l-2.5-11.7c-.2-.9-.9-1.5-1.8-1.5h-1.2z" opacity="0.3"/>
            <path d="M12.1 9.5c-.5 0-.9.3-1 .8l-1.9 8.8c-.1.2 0 .4.1.5.1.1.3.2.5.2h3.7c.2 0 .4-.1.5-.2.1-.1.2-.3.1-.5l-1.9-8.8c-.1-.5-.5-.8-1-.8h-1.2z" opacity="0.5"/>
          </svg>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-slate-800 mb-1">
              📨 Correo Empresarial
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              Conecta tu cuenta de Outlook (@vtmlogistics.com) para ver los correos de clientes, 
              filtrar por carga o cotización, y convertirlos en órdenes de trabajo directamente.
            </p>
            <button
              onClick={() => onNavigate('email')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Ir a Correo Empresarial
            </button>
          </div>
        </div>
      </div>

      {/* Aquí puedes poner el contenido original de OrdersModule (lista de pedidos, formularios, etc.) */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-base font-semibold text-slate-800 mb-3">📋 Pedidos Recientes</h3>
        <p className="text-sm text-slate-500">
          Aquí va la lista de pedidos. Por ahora puedes integrar tu lógica existente de pedidos aquí.
        </p>
      </div>
    </div>
  );
}