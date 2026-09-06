import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Shield, Crown, Check } from 'lucide-react';
import { useAuth } from '../context/auth.jsx';
import { Brand } from '../components/brand.jsx';
import { Button } from '../components/ui/button.jsx';
import { Field, InputBare } from '../components/ui/input.jsx';
import { Alert } from '../components/ui/alert.jsx';

const IDENTITIES = [
  {
    id: 'PRIVATE_CLIENT',
    label: 'Private Client',
    desc: 'A worried citizen who entrusts you with this case.',
    Icon: User,
  },
  {
    id: 'SCOTLAND_YARD',
    label: 'Scotland Yard',
    desc: 'The Yard hands you official access to the case files.',
    Icon: Shield,
  },
  {
    id: 'MYCROFT_HOLMES',
    label: 'Mycroft Holmes',
    desc: 'A sharp broker who briefs you with the whole map.',
    Icon: Crown,
  },
];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [identity, setIdentity] = useState(IDENTITIES[0].id);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  function set(k) {
    return (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register(form.name.trim(), form.email.trim(), form.password, identity);
      navigate('/join', { replace: true });
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
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <p className="font-mono text-xs text-mark-faint">MEMBER ROSTER</p>
        <h1 className="mt-1 font-type text-3xl text-ink">Join Event</h1>
        <p className="mt-2 text-sm text-ink-faint">Create your participant account, then join with the event code.</p>

        <Field label="Choose who brought you your cases">
          <div className="space-y-2">
            {IDENTITIES.map(({ id, label, desc, Icon }) => {
              const active = identity === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setIdentity(id)}
                  className={`flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors ${
                    active ? 'border-mark bg-mark/10' : 'border-edge hover:bg-ink/5'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${active ? 'text-mark' : 'text-ink-faint'}`} />
                  <span className="min-w-0">
                    <span className={`block text-sm font-semibold ${active ? 'text-ink' : 'text-ink-soft'}`}>{label}</span>
                    <span className="block text-xs text-ink-faint">{desc}</span>
                  </span>
                  {active && <Check className="ml-auto h-4 w-4 text-mark" />}
                </button>
              );
            })}
          </div>
        </Field>

        <form className="mt-4 space-y-4" onSubmit={onSubmit}>
          <Field label="Name">
            <InputBare required minLength={2} value={form.name} onChange={set('name')} autoComplete="name" />
          </Field>
          <Field label="Email">
            <InputBare type="email" required value={form.email} onChange={set('email')} autoComplete="email" />
          </Field>
          <Field label="Password">
            <InputBare
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={set('password')}
              autoComplete="new-password"
            />
          </Field>
          {error && <Alert tone="danger">{error}</Alert>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-ink-faint">
          Already registered?{' '}
          <Link to="/login" className="font-medium text-mark underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}