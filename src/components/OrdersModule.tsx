// src/components/OrdersModule.tsx
import { useState, useEffect } from 'react';
import { MsalProvider, useMsal } from '@azure/msal-react';
import { msalInstance, loginRequest } from '../lib/msal';
import type { ActiveView } from '../App';
import { supabase } from '../lib/supabase';

interface Props {
  onNavigate: (v: ActiveView) => void;
}

interface Email {
  id: string;
  subject: string;
  sender?: {
    emailAddress?: {
      name?: string;
      address?: string;
    };
  };
  from?: {
    emailAddress?: {
      name?: string;
      address?: string;
    };
  };
  receivedDateTime: string;
  bodyPreview: string;
  importance: string;
  isRead: boolean;
}

// ✅ COMPONENTE DE LOGIN DE OUTLOOK (MEJORADO)
function OutlookLogin({ 
  onLoginSuccess, 
  onLoginError 
}: { 
  onLoginSuccess: (accessToken: string) => void;
  onLoginError: (error: Error) => void;
}) {
  const { instance } = useMsal();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOutlookLogin = async () => {
    try {
      setLoading(true);
      setError(null);

      // ✅ Forzar a que pida el correo empresarial
      const response = await instance.loginPopup({
        ...loginRequest,
        prompt: 'select_account',
        extraQueryParameters: {
          domain_hint: 'vtmlogistics.com'
        }
      });

      console.log('✅ Login con Outlook exitoso:', response);
      console.log('👤 Usuario autenticado:', response.account?.username);

      const accessToken = response.accessToken;
      onLoginSuccess(accessToken);

    } catch (err: any) {
      console.error('❌ Error al iniciar sesión con Outlook:', err);
      
      // ✅ Mensaje específico para error de dominio
      if (err.errorMessage?.includes('domain_hint')) {
        setError('❌ Debes usar una cuenta empresarial @vtmlogistics.com');
      } else {
        setError(err.errorMessage || 'Error al iniciar sesión con Outlook');
      }
      onLoginError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-full bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
        <p className="font-semibold">📧 Conectar correo empresarial</p>
        <p className="text-xs mt-1">Usa tu cuenta de Outlook (@vtmlogistics.com) para ver tus correos empresariales.</p>
      </div>

      <button
        onClick={handleOutlookLogin}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-slate-300 rounded-xl shadow-sm bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
            <span>Conectando con Outlook...</span>
          </div>
        ) : (
          <>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#0078D4">
              <path d="M11.4 2.8c-1.2 0-2.2.8-2.5 1.9L5.2 18.9c-.1.5 0 1 .3 1.4.3.4.8.7 1.3.7h10.4c.5 0 1-.3 1.3-.7.3-.4.4-.9.3-1.4L15.1 4.7c-.3-1.1-1.3-1.9-2.5-1.9h-1.2z"/>
              <path d="M12.1 7.4c-.9 0-1.6.6-1.8 1.5l-2.5 11.7c-.1.3 0 .6.2.8.2.2.4.3.7.3h5.7c.3 0 .5-.1.7-.3.2-.2.3-.5.2-.8l-2.5-11.7c-.2-.9-.9-1.5-1.8-1.5h-1.2z" opacity="0.3"/>
              <path d="M12.1 9.5c-.5 0-.9.3-1 .8l-1.9 8.8c-.1.2 0 .4.1.5.1.1.3.2.5.2h3.7c.2 0 .4-.1.5-.2.1-.1.2-.3.1-.5l-1.9-8.8c-.1-.5-.5-.8-1-.8h-1.2z" opacity="0.5"/>
            </svg>
            <span>Conectar correo empresarial (@vtmlogistics.com)</span>
          </>
        )}
      </button>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 w-full">
          ❌ {error}
        </div>
      )}
    </div>
  );
}

// ✅ COMPONENTE DE LISTA DE CORREOS (sin cambios)
function EmailList({ 
  accessToken, 
  filter,
  onConvertToOT 
}: { 
  accessToken: string;
  filter: string;
  onConvertToOT: (email: Email) => void;
}) {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmails = async () => {
    try {
      setLoading(true);
      setError(null);

      let filterQuery = '';
      switch (filter) {
        case 'carga':
          filterQuery = '?$filter=contains(subject, "carga") or contains(subject, "envio") or contains(subject, "transporte") or contains(subject, "entrega") or contains(subject, "pack") or contains(subject, "contenedor") or contains(subject, "pallet")';
          break;
        case 'cotizacion':
          filterQuery = '?$filter=contains(subject, "cotizacion") or contains(subject, "presupuesto") or contains(subject, "oferta") or contains(subject, "precio") or contains(subject, "valor") or contains(subject, "solicitud")';
          break;
        default:
          filterQuery = '?$top=30&$orderby=receivedDateTime desc';
          break;
      }

      const url = `https://graph.microsoft.com/v1.0/me/messages${filterQuery}`;
      console.log('📧 URL de consulta:', url);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Error al obtener correos: ${response.status}`);
      }

      const data = await response.json();
      console.log('📧 Correos obtenidos:', data.value?.length || 0);
      setEmails(data.value || []);
      
    } catch (err) {
      console.error('❌ Error al obtener correos:', err);
      setError(err instanceof Error ? err.message : 'Error al obtener correos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) {
      fetchEmails();
    }
  }, [accessToken, filter]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Ahora';
    if (diffMin < 60) return `${diffMin}m`;
    if (diffHour < 24) return `${diffHour}h`;
    if (diffDay < 7) return `${diffDay}d`;
    return date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const highlightText = (text: string) => {
    if (filter === 'todos' || !text) return text;
    
    const keywords: Record<string, string[]> = {
      'carga': ['carga', 'envio', 'transporte', 'entrega', 'pack', 'contenedor', 'pallet', 'cargamento'],
      'cotizacion': ['cotizacion', 'presupuesto', 'oferta', 'precio', 'valor', 'solicitud', 'cotizar']
    };
    
    const words = keywords[filter] || [];
    let highlighted = text;
    words.forEach(word => {
      const regex = new RegExp(`(${word})`, 'gi');
      highlighted = highlighted.replace(regex, '<mark class="bg-yellow-200/70 px-0.5 rounded">$1</mark>');
    });
    return highlighted;
  };

  const getSenderName = (email: Email): string => {
    const sender = email.sender || email.from;
    
    if (sender && typeof sender === 'object' && 'emailAddress' in sender) {
      const emailAddress = sender.emailAddress;
      if (emailAddress && typeof emailAddress === 'object') {
        return emailAddress.name || emailAddress.address || 'Remitente';
      }
      return 'Remitente';
    }
    
    if (typeof sender === 'string') {
      return sender;
    }
    
    if (sender && typeof sender === 'object' && 'name' in sender) {
      const name = (sender as any).name;
      return typeof name === 'string' ? name : 'Remitente';
    }
    
    return 'Remitente';
  };

  const getSenderEmail = (email: Email): string => {
    const sender = email.sender || email.from;
    
    if (sender && typeof sender === 'object' && 'emailAddress' in sender) {
      const emailAddress = sender.emailAddress;
      if (emailAddress && typeof emailAddress === 'object') {
        return emailAddress.address || '';
      }
      return '';
    }
    
    if (typeof sender === 'string') {
      return sender;
    }
    
    if (sender && typeof sender === 'object' && 'address' in sender) {
      const address = (sender as any).address;
      return typeof address === 'string' ? address : '';
    }
    
    return '';
  };

  const getInitials = (name: string): string => {
    if (!name || name === 'Remitente') return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
          <p className="mt-2 text-sm text-slate-500">Cargando correos empresariales...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
        ❌ {error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {emails.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-500">No hay correos empresariales que coincidan con el filtro</p>
        </div>
      ) : (
        emails.map((email) => {
          const senderName = getSenderName(email);
          const senderEmail = getSenderEmail(email);
          const initials = getInitials(senderName);
          const isUrgent = email.importance === 'high' || (email.subject && email.subject.toLowerCase().includes('urgente'));
          const isUnread = !email.isRead;

          return (
            <div 
              key={email.id} 
              className={`flex gap-4 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer rounded-lg border ${
                isUnread ? 'bg-blue-50/30 border-blue-100' : 'border-slate-200 bg-white'
              }`}
            >
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                style={{ background: isUnread ? '#1e4278' : '#64748b' }}
              >
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <span className={`text-sm truncate ${isUnread ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                      {senderName}
                    </span>
                    <span className="text-xs text-slate-400 truncate hidden sm:inline">
                      {senderEmail}
                    </span>
                    {isUrgent && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 flex-shrink-0">
                        URGENTE
                      </span>
                    )}
                    {isUnread && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 flex-shrink-0">
                        Nuevo
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0 ml-2">
                    {formatDate(email.receivedDateTime)}
                  </span>
                </div>
                <div 
                  className="text-xs font-semibold text-slate-700 mt-0.5"
                  dangerouslySetInnerHTML={{ 
                    __html: highlightText(email.subject || 'Sin asunto') 
                  }} 
                />
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  {email.bodyPreview || 'Sin contenido'}
                </p>
                <div className="flex gap-2 mt-2 flex-wrap">
                  <button
                    onClick={() => onConvertToOT(email)}
                    className="text-[11px] font-semibold px-3 py-1 rounded border text-blue-700 border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors"
                  >
                    Convertir en OT →
                  </button>
                  <button className="text-[11px] font-semibold px-3 py-1 rounded border text-slate-600 border-slate-200 hover:bg-slate-100 transition-colors">
                    Generar cotización
                  </button>
                  <button 
                    onClick={() => window.open(`https://outlook.office.com/mail/id/${email.id}`, '_blank')}
                    className="text-[11px] text-slate-400 px-2 py-1 hover:text-slate-600 transition-colors"
                  >
                    Ver en Outlook
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ✅ COMPONENTE PRINCIPAL
export default function OrdersModule({ onNavigate }: Props) {
  const [outlookToken, setOutlookToken] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'todos' | 'carga' | 'cotizacion'>('todos');
  const [outlookUser, setOutlookUser] = useState<string | null>(null);

  const handleOutlookLoginSuccess = (token: string) => {
    setOutlookToken(token);
    setIsConnected(true);
    setConnectionError(null);
  };

  const handleOutlookLoginError = (error: Error) => {
    setConnectionError(error.message);
    setIsConnected(false);
  };

  const handleConvertToOT = (email: Email) => {
    console.log('📧 Convertir a OT:', email);
    onNavigate('cargo');
  };

  // ✅ Obtener el usuario de Outlook después de conectar
  useEffect(() => {
    if (outlookToken) {
      // Opcional: obtener el email del usuario desde la sesión de MSAL
      const account = msalInstance.getActiveAccount();
      if (account) {
        setOutlookUser(account.username || account.name || 'Usuario Outlook');
      }
    }
  }, [outlookToken]);

  return (
    <MsalProvider instance={msalInstance}>
      <div className="p-6 max-w-screen-xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">📧 Pedidos / Correo</h1>
            <p className="text-sm text-slate-500 mt-0.5">Correos empresariales (@vtmlogistics.com)</p>
          </div>
          <button
            onClick={() => onNavigate('cargo')}
            className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: '#1e4278' }}
          >
            + Nueva OT Manual
          </button>
        </div>

        {/* Conexión con Outlook */}
        {!isConnected ? (
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="#0078D4">
                <path d="M11.4 2.8c-1.2 0-2.2.8-2.5 1.9L5.2 18.9c-.1.5 0 1 .3 1.4.3.4.8.7 1.3.7h10.4c.5 0 1-.3 1.3-.7.3-.4.4-.9.3-1.4L15.1 4.7c-.3-1.1-1.3-1.9-2.5-1.9h-1.2z"/>
                <path d="M12.1 7.4c-.9 0-1.6.6-1.8 1.5l-2.5 11.7c-.1.3 0 .6.2.8.2.2.4.3.7.3h5.7c.3 0 .5-.1.7-.3.2-.2.3-.5.2-.8l-2.5-11.7c-.2-.9-.9-1.5-1.8-1.5h-1.2z" opacity="0.3"/>
                <path d="M12.1 9.5c-.5 0-.9.3-1 .8l-1.9 8.8c-.1.2 0 .4.1.5.1.1.3.2.5.2h3.7c.2 0 .4-.1.5-.2.1-.1.2-.3.1-.5l-1.9-8.8c-.1-.5-.5-.8-1-.8h-1.2z" opacity="0.5"/>
              </svg>
              <h2 className="text-lg font-semibold text-slate-800">📨 Conectar correo empresarial</h2>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Conecta tu correo de Outlook (@vtmlogistics.com) para ver los correos de clientes directamente aquí.
              <span className="block text-xs text-slate-400 mt-1">
                ⚠️ Debes usar tu cuenta empresarial (@vtmlogistics.com), no tu cuenta personal.
              </span>
            </p>
            <OutlookLogin 
              onLoginSuccess={handleOutlookLoginSuccess}
              onLoginError={handleOutlookLoginError}
            />
            {connectionError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                ❌ {connectionError}
              </div>
            )}
          </div>
        ) : (
          <div>
            {/* ✅ Conectado */}
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <span>✅ Conectado a Outlook empresarial</span>
                {outlookUser && (
                  <span className="text-xs text-green-600 block sm:inline sm:ml-2">
                    👤 {outlookUser}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-green-600">📧 Correos empresariales</span>
                <button
                  onClick={() => {
                    setIsConnected(false);
                    setOutlookToken(null);
                    setOutlookUser(null);
                  }}
                  className="text-red-500 hover:text-red-700 text-xs font-semibold"
                >
                  Desconectar
                </button>
              </div>
            </div>

            {/* ✅ Filtros */}
            <div className="mb-4 flex gap-2 flex-wrap">
              <button
                onClick={() => setFilter('todos')}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  filter === 'todos' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                📬 Todos
              </button>
              <button
                onClick={() => setFilter('carga')}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  filter === 'carga' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                📦 Carga
              </button>
              <button
                onClick={() => setFilter('cotizacion')}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  filter === 'cotizacion' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                💰 Cotización
              </button>
              <span className="ml-auto text-sm text-slate-400 self-center">
                {filter === 'todos' ? 'Todos' : filter === 'carga' ? '📦 Carga' : '💰 Cotización'}
              </span>
            </div>

            {/* ✅ Lista de correos */}
            {outlookToken && (
              <EmailList 
                accessToken={outlookToken} 
                filter={filter}
                onConvertToOT={handleConvertToOT}
              />
            )}
          </div>
        )}
      </div>
    </MsalProvider>
  );
}