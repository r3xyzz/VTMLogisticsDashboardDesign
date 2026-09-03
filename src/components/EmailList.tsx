// ✅ COMPONENTE DE LISTA DE CORREOS (CORREGIDO)
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

  // ✅ Función para obtener correos desde Microsoft Graph
  const fetchEmails = async () => {
    try {
      setLoading(true);
      setError(null);

      let filterQuery = '';
      switch (filter) {
        case 'carga':
          filterQuery = `?$filter=contains(subject,'carga') or contains(subject,'envio') or contains(subject,'transporte') or contains(subject,'entrega') or contains(subject,'pack') or contains(subject,'contenedor') or contains(subject,'pallet')`;
          break;
        case 'cotizacion':
          filterQuery = `?$filter=contains(subject,'cotizacion') or contains(subject,'presupuesto') or contains(subject,'oferta') or contains(subject,'precio') or contains(subject,'valor') or contains(subject,'solicitud')`;
          break;
        default:
          filterQuery = `?$top=30&$orderby=receivedDateTime desc`;
          break;
      }

      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/messages${filterQuery}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

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

  // ✅ Formatear fecha
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

  // ✅ Resaltar texto en el asunto según el filtro
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

  // ✅ Obtener el nombre del remitente de forma segura
  const getSenderName = (email: Email) => {
    const sender = email.sender || email.from;
    
    if (sender && typeof sender === 'object' && 'emailAddress' in sender) {
      return sender.emailAddress?.name || sender.emailAddress?.address || 'Remitente';
    }
    
    if (typeof sender === 'string') {
      return sender;
    }
    
    if (sender && typeof sender === 'object' && 'name' in sender) {
      return sender.name || 'Remitente';
    }
    
    return 'Remitente';
  };

  // ✅ Obtener el email del remitente de forma segura
  const getSenderEmail = (email: Email) => {
    const sender = email.sender || email.from;
    
    if (sender && typeof sender === 'object' && 'emailAddress' in sender) {
      return sender.emailAddress?.address || '';
    }
    
    if (typeof sender === 'string') {
      return sender;
    }
    
    if (sender && typeof sender === 'object' && 'address' in sender) {
      return sender.address || '';
    }
    
    return '';
  };

  // ✅ Obtener iniciales del remitente
  const getInitials = (name: string) => {
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
          <p className="mt-2 text-sm text-slate-500">Cargando correos...</p>
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
          <p className="text-gray-500">No hay correos que coincidan con el filtro</p>
        </div>
      ) : (
        emails.map((email) => {
          const senderName = getSenderName(email);
          const senderEmail = getSenderEmail(email);
          const initials = getInitials(senderName);
          const isUrgent = email.importance === 'high' || email.subject?.toLowerCase().includes('urgente');
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