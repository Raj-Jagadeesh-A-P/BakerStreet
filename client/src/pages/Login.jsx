import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth.jsx';
import { Brand } from '../components/brand.jsx';
import { Button } from '../components/ui/button.jsx';
import { Field, InputBare } from '../components/ui/input.jsx';
import { Alert } from '../components/ui/alert.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = await login(email.trim(), password);
      navigate(user.role === 'ADMIN' ? '/admin/events' : from, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <div className="noir-texture border-b border-edge bg-surface/80 px-4 py-3">
        <Brand />
      </div>
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
        <p className="font-mono text-xs text-mark-faint">AGENT ACCESS</p>
        <h1 className="mt-1 font-type text-3xl text-ink">Login</h1>
        <p className="mt-2 text-sm text-ink-faint">Participant or organizer account.</p>
        <form className="mt-8 space-y-4" onSubmit={onSubmit}>
          <Field label="Email">
            <InputBare type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          <Field label="Password">
            <InputBare type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </Field>
          {error && <Alert tone="danger">{error}</Alert>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Logging in…' : 'Login'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-ink-faint">
          New here?{' '}
          <Link to="/register" className="font-medium text-mark underline">
            Join the event
          </Link>
        </p>
      </div>
    </div>
  );
}