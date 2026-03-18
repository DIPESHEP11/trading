import React, { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSent(false);
    try {
      // TODO: Integrate with backend /auth/password-reset/ when superadmin flow is ready
      await new Promise((r) => setTimeout(r, 500));
      setSent(true);
      toast.success('If an account exists, you will receive a reset link.');
    } catch {
      toast.error('Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <h1>Trai<span>ding</span></h1>
          <p>Reset your password</p>
        </div>

        {sent ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: 16 }}>
              Check your email for a password reset link. If you don&apos;t see it, check spam or contact your administrator.
            </p>
            <Link to="/login" className="btn btn-primary">Back to login</Link>
          </div>
        ) : (
          <>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 20 }}>
              Enter your email and we&apos;ll send you a link to reset your password.
            </p>

            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
                {loading ? <span className="spinner" /> : 'Send reset link'}
              </button>
            </form>
          </>
        )}

        <div className="auth-footer">
          <Link to="/login">Back to login</Link>
        </div>
      </div>
    </div>
  );
}
