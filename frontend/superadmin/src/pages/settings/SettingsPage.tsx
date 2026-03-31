export default function SettingsPage() {
  return (
    <div className="page-header">
      <h1 className="page-title">Settings</h1>
      <p className="page-subtitle">Superadmin settings and preferences.</p>
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-body">
          <p style={{ color: 'var(--color-text-muted)' }}>
            Settings configuration will be available here. You can manage global defaults, branding, and system preferences.
          </p>
        </div>
      </div>
    </div>
  );
}
