// supabase/functions/send-client-notifications/index.ts
// Envía los correos de estado al cliente (sin fotos) que encola el trigger de documents.
//
// Despliegue:
//   supabase functions deploy send-client-notifications
//   supabase secrets set RESEND_API_KEY=re_xxx MAIL_FROM="VTM Logistics <operaciones@vtmlogistics.com>"
// Disparo: Database > Webhooks > INSERT en public.client_notifications -> esta función
//          (o desde POD con el botón "Enviar avisos pendientes").
// El dominio de MAIL_FROM debe estar verificado en Resend.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('MAIL_FROM');
  if (!apiKey || !from) {
    return new Response(JSON.stringify({ error: 'Faltan los secretos RESEND_API_KEY y MAIL_FROM' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: pending, error } = await supabase
    .from('client_notifications')
    .select('id, to_email, subject, body')
    .eq('status', 'pending')
    .not('to_email', 'is', null)
    .order('created_at')
    .limit(20);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  let sent = 0;
  for (const row of pending || []) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [row.to_email],
        subject: row.subject,
        text: row.body,
        html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a;white-space:pre-line">${escapeHtml(row.body)}</div>`,
      }),
    });
    if (response.ok) {
      sent++;
      await supabase.from('client_notifications').update({ status: 'sent', sent_at: new Date().toISOString(), error: null }).eq('id', row.id);
    } else {
      await supabase.from('client_notifications').update({ status: 'error', error: (await response.text()).slice(0, 500) }).eq('id', row.id);
    }
  }

  return new Response(JSON.stringify({ processed: pending?.length || 0, sent }), { headers: { ...cors, 'Content-Type': 'application/json' } });
});
