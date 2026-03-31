import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '@/api/authApi';
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
      await authApi.requestPasswordReset(email.trim());
      setSent(true);
      toast.success('If that email exists, a reset link has been sent.');
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string } } };
      toast.error(ex?.response?.data?.message || 'Failed to send reset link.');
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
          <div className="alert alert-success" style={{ marginBottom: 20 }}>
            If that email exists in our system, we&apos;ve sent a password reset link. Check your inbox and spam folder.
            The link expires in 24 hours.
          </div>
        ) : (
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
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 8 }}>
                Enter the email associated with your account. We&apos;ll send you a link to set a new password.
              </p>
            </div>

            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Send Reset Link'}
            </button>
          </form>
        )}

        <div className="auth-footer">
          Remember your password? <Link to="/login">Sign In</Link>
        </div>
      </div>
    </div>
  );
}
