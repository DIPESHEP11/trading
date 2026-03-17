import { useEffect, useState } from 'react';
import axios from '@/api/axiosInstance';

type Client = { domain: string; name: string };

export default function ClientSelectPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    axios
      .get('/tenants/domains/')
      .then((res) => {
        const data = res?.data?.data ?? res?.data;
        setClients(data?.clients ?? []);
      })
      .catch(() => setError('Could not load clients.'))
      .finally(() => setLoading(false));
  }, []);

  const port = window.location.port || '5174';
  const loginUrl = (domain: string) => `http://${domain}:${port}/login`;

  return (
    <div className="auth-page" style={{ padding: '40px 20px' }}>
      <div className="auth-card" style={{ maxWidth: 420 }}>
        <div className="auth-logo">
          <h1>Trai<span>ding</span></h1>
          <p>Select your client</p>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <span className="spinner" />
          </div>
        )}

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 20 }}>
            {error}
          </div>
        )}

        {!loading && !error && clients.length === 0 && (
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 20 }}>
            No clients found. Contact your administrator.
          </p>
        )}

        {!loading && clients.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {clients.map((c) => (
              <a
                key={c.domain}
                href={loginUrl(c.domain)}
                className="btn btn-primary btn-full"
                style={{ textAlign: 'center', textDecoration: 'none' }}
              >
                {c.name}
              </a>
            ))}
          </div>
        )}

        <p style={{ marginTop: 24, fontSize: 13, color: 'var(--color-text-muted)' }}>
          Click a client to open its login page.
        </p>
      </div>
    </div>
  );
}
