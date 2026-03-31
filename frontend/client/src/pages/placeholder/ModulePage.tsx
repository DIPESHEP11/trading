import { useParams } from 'react-router-dom';

const MODULE_INFO: Record<string, { icon: string; label: string; desc: string }> = {
  warehouse:     { icon: '🏬', label: 'Warehouse',     desc: 'Multi-warehouse storage, stock transfers and location management.' },
  analytics:     { icon: '📊', label: 'Analytics',     desc: 'Reports, charts and dashboard insights for your business.' },
  tracking:      { icon: '📍', label: 'Tracking',      desc: 'Real-time courier and shipment tracking.' },
  manufacturing: { icon: '⚙️', label: 'Manufacturing', desc: 'Production planning, bill of materials and work orders.' },
  dispatch:      { icon: '🚚', label: 'Dispatch',      desc: 'Shipping stickers, courier management and dispatch notes.' },
};

interface Props {
  module?: string;
}

export default function ModulePage({ module: moduleProp }: Props) {
  const { module: moduleParam } = useParams<{ module: string }>();
  const key = moduleProp ?? moduleParam ?? '';
  const info = MODULE_INFO[key];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1e293b' }}>
          {info ? info.label : 'Module'}
        </h2>
        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>
          {info?.desc ?? 'This module is assigned to your account.'}
        </p>
      </div>

      <div className="card" style={{ textAlign: 'center', padding: '72px 32px' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>{info?.icon ?? '📦'}</div>
        <h3 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: '0 0 8px' }}>
          {info ? `${info.label} — Coming Soon` : 'Coming Soon'}
        </h3>
        <p style={{ color: '#64748b', fontSize: 14, maxWidth: 420, margin: '0 auto' }}>
          {info?.desc ?? 'This module is under active development.'} <br />
          It will be available in a future update.
        </p>
        <div style={{ marginTop: 24 }}>
          <span style={{
            display: 'inline-block', background: '#eff6ff', color: '#3b82f6',
            border: '1px solid #bfdbfe', borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 600,
          }}>
            🔧 In Development
          </span>
        </div>
      </div>
    </div>
  );
}
