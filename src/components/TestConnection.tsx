// src/components/TestConnection.tsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Client {
    id: string;
    code: string;
    name: string;
    contact_name: string | null;
    is_active: boolean;
}

export function TestConnection() {
    const [loading, setLoading] = useState(true);
    const [clients, setClients] = useState<Client[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<string>('Iniciando prueba...');

    useEffect(() => {
        testConnection();
    }, []);

    async function testConnection() {
        try {
            setConnectionStatus('🔌 Conectando a Supabase...');
            
            // 1. Probar conexión con la tabla clients
            const { data, error } = await supabase
                .from('clients')
                .select('*')
                .limit(5);

            if (error) {
                setConnectionStatus('❌ Error en la consulta');
                throw error;
            }
            
            setConnectionStatus('✅ Conexión exitosa!');
            setClients(data || []);
            
            console.log('✅ Clientes obtenidos:', data);
        } catch (err) {
            console.error('❌ Error de conexión:', err);
            setError(err instanceof Error ? err.message : 'Error desconocido');
            setConnectionStatus('❌ Error de conexión');
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div style={{ padding: '20px', textAlign: 'center' }}>
                <h3>{connectionStatus}</h3>
                <div style={{ marginTop: '10px' }}>⏳ Esperando respuesta de Supabase...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: '20px', background: '#fee2e2', borderRadius: '8px', color: '#991b1b' }}>
                <h3 style={{ color: '#991b1b' }}>❌ Error de conexión</h3>
                <p><strong>Mensaje:</strong> {error}</p>
                <details style={{ marginTop: '10px', cursor: 'pointer' }}>
                    <summary>🔍 Ver detalles técnicos</summary>
                    <pre style={{ background: '#f3f4f6', padding: '10px', borderRadius: '4px', marginTop: '10px', fontSize: '12px', overflow: 'auto' }}>
                        {JSON.stringify({ supabaseUrl: 'https://bxgfykzjqggwqjgzwbpj.supabase.co', error }, null, 2)}
                    </pre>
                </details>
                <p style={{ marginTop: '10px', fontSize: '14px' }}>
                    💡 <strong>Posibles soluciones:</strong>
                    <br />1. Verifica que la ANON KEY esté correcta
                    <br />2. Verifica que el proyecto de Supabase esté activo
                    <br />3. Verifica que las tablas estén creadas
                </p>
            </div>
        );
    }

    return (
        <div style={{ padding: '20px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #22c55e' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>✅</span>
                <div>
                    <h3 style={{ color: '#166534', margin: 0 }}>¡Conexión exitosa a Supabase!</h3>
                    <p style={{ color: '#15803d', margin: '5px 0 0 0' }}>{connectionStatus}</p>
                </div>
            </div>

            <div style={{ marginTop: '15px' }}>
                <p><strong>📊 Datos obtenidos:</strong> {clients.length} clientes encontrados</p>
                
                {clients.length > 0 ? (
                    <div style={{ background: '#f3f4f6', padding: '10px', borderRadius: '4px', marginTop: '10px' }}>
                        <p style={{ fontWeight: 'bold', margin: '0 0 10px 0' }}>Lista de clientes:</p>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {clients.map((client) => (
                                <li key={client.id} style={{ 
                                    padding: '8px 10px', 
                                    borderBottom: '1px solid #e5e7eb',
                                    display: 'flex',
                                    justifyContent: 'space-between'
                                }}>
                                    <span><strong>{client.code}</strong> - {client.name}</span>
                                    <span style={{ color: '#6b7280' }}>
                                        {client.contact_name || 'Sin contacto'}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <p style={{ color: '#6b7280' }}>No hay clientes en la tabla (puede que necesites insertar datos)</p>
                )}

                <details style={{ marginTop: '15px', cursor: 'pointer' }}>
                    <summary>📋 Ver datos completos (JSON)</summary>
                    <pre style={{ background: '#f3f4f6', padding: '10px', borderRadius: '4px', marginTop: '10px', fontSize: '12px', overflow: 'auto', maxHeight: '300px' }}>
                        {JSON.stringify(clients, null, 2)}
                    </pre>
                </details>
            </div>
        </div>
    );
}