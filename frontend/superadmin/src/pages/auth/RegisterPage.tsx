import React, { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '@/api/authApi';
import { restrictTo10Digits } from '@/utils/phone';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [form, setForm] = useState({
    email: '', first_name: '', last_name: '', phone: '',
    password: '', password_confirm: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.password_confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.register(form);
      setAuth(res.data, res.data.access, res.data.refresh);
      toast.success('Account created!');
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <h1>Trai<span>ding</span></h1>
          <p>Create your account</p>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: '20px' }}>{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">First Name</label>
              <input name="first_name" className="form-input" placeholder="John"
                value={form.first_name} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name</label>
              <input name="last_name" className="form-input" placeholder="Doe"
                value={form.last_name} onChange={handleChange} required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input name="email" type="email" className="form-input" placeholder="you@example.com"
              value={form.email} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label className="form-label">Phone (optional)</label>
            <input name="phone" type="tel" className="form-input" placeholder="9876543210" maxLength={10}
              value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: restrictTo10Digits(e.target.value) }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input name="password" type="password" className="form-input" placeholder="••••••••"
              value={form.password} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input name="password_confirm" type="password" className="form-input" placeholder="••••••••"
              value={form.password_confirm} onChange={handleChange} required />
          </div>
          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account? <Link to="/login">Sign In</Link>
        </div>
      </div>
    </div>
  );
}
