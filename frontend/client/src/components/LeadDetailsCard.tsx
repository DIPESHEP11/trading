/** Lead details shown when a record originates from a CRM lead (e.g. Order, Inventory Approval, Invoice) */
export interface LeadDetails {
  id: number;
  name: string;
  email: string;
  phone: string;
  company: string;
  notes: string;
  source: string;
  status: string;
  custom_data?: Record<string, string>;
  assigned_to_name?: string | null;
}

interface LeadDetailsCardProps {
  lead: LeadDetails;
  compact?: boolean;
}

export default function LeadDetailsCard({ lead, compact }: LeadDetailsCardProps) {
  if (!lead) return null;

  const rows: { label: string; value: string }[] = [
    { label: 'Name', value: lead.name || '—' },
    { label: 'Email', value: lead.email || '—' },
    { label: 'Phone', value: lead.phone || '—' },
    { label: 'Company', value: lead.company || '—' },
    { label: 'Source', value: lead.source || '—' },
    { label: 'Status', value: lead.status || '—' },
    { label: 'Assigned to', value: lead.assigned_to_name || '—' },
    { label: 'Notes', value: lead.notes || '—' },
  ].filter((r) => r.value && r.value !== '—');

  const customRows = lead.custom_data && Object.keys(lead.custom_data).length > 0
    ? Object.entries(lead.custom_data).map(([k, v]) => ({ label: k.replace(/_/g, ' '), value: String(v) }))
    : [];

  return (
    <div style={{
      background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
      border: '1px solid #bae6fd',
      borderRadius: 10,
      padding: compact ? 12 : 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: compact ? 8 : 12 }}>
        <span style={{ fontSize: 18 }}>👤</span>
        <strong style={{ fontSize: 14, color: '#0c4a6e' }}>Lead Details</strong>
        <span style={{ fontSize: 11, color: '#64748b', marginLeft: 4 }}>(from CRM)</span>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: compact ? '1fr 1fr' : '1fr 1fr 1fr',
        gap: compact ? 6 : 8,
        fontSize: 12,
      }}>
        {rows.slice(0, compact ? 6 : rows.length).map((r) => (
          <div key={r.label}>
            <div style={{ color: '#64748b', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>{r.label}</div>
            <div style={{ color: '#1e293b', fontWeight: 500 }}>{r.value}</div>
          </div>
        ))}
      </div>
      {customRows.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #bae6fd' }}>
          <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Custom fields</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {customRows.map(({ label, value }) => (
              <span key={label} style={{ fontSize: 11, background: '#fff', padding: '2px 8px', borderRadius: 6 }}>
                <strong>{label}:</strong> {value}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
