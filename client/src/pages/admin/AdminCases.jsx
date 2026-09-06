import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Square, Pencil, Trash2, ChevronUp, ChevronDown, Plus, Save, FileText } from 'lucide-react';
import { api } from '../../api.js';
import { Button } from '../../components/ui/button.jsx';
import { Card, CardContent } from '../../components/ui/card.jsx';
import { Badge } from '../../components/ui/badge.jsx';
import { Dialog } from '../../components/ui/dialog.jsx';
import { Alert } from '../../components/ui/alert.jsx';
import { InputBare, Field } from '../../components/ui/input.jsx';
import { PageState, ErrorState } from '../../components/ui/state.jsx';

const STATUS_TONE = { LOCKED: 'default', OPEN: 'gold', CLOSED: 'success' };

const EMPTY_PODIUM = { first: 300, second: 200, third: 100, participation: 0 };

function CaseEditor({ open, onClose, eventId, caseRow, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [f, setF] = useState({});
  const [answersText, setAnswersText] = useState('');

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (caseRow) {
      setF({
        title: caseRow.title,
        plot: caseRow.plot ?? '',
        published: caseRow.published,
        closing: {
          caseInsensitive: caseRow.closing?.caseInsensitive ?? true,
          normalize: caseRow.closing?.normalize ?? true,
          regex: caseRow.closing?.regex ?? '',
        },
        podium: { ...EMPTY_PODIUM, ...(caseRow.podium || {}) },
      });
      setAnswersText((caseRow.closing?.answers ?? []).join('\n'));
    } else {
      setF({
        title: '',
        plot: '',
        published: true,
        closing: { caseInsensitive: true, normalize: true, regex: '' },
        podium: { ...EMPTY_PODIUM },
      });
      setAnswersText('');
    }
  }, [open, caseRow]);

  function set(k) {
    return (e) => setF((prev) => ({ ...prev, [k]: e.target.value }));
  }
  function setClosing(k) {
    return (e) => setF((prev) => ({ ...prev, closing: { ...prev.closing, [k]: e.target.value } }));
  }
  function setPodium(k) {
    return (e) => setF((prev) => ({ ...prev, podium: { ...prev.podium, [k]: Number(e.target.value) || 0 } }));
  }

  async function save(e) {
    e.preventDefault();
    if (answersText.split('\n').map((s) => s.trim()).filter(Boolean).length === 0) {
      setError('Add at least one closing answer.');
      return;
    }
    setError(null);
    setBusy(true);
    const body = {
      title: f.title,
      plot: f.plot,
      published: f.published,
      closing: {
        answers: answersText.split('\n').map((s) => s.trim()).filter(Boolean),
        caseInsensitive: f.closing.caseInsensitive,
        normalize: f.closing.normalize,
        regex: f.closing.regex,
      },
      podium: f.podium,
    };
    try {
      if (caseRow) {
        await api(`/admin/cases/${caseRow.id}`, { method: 'PUT', body });
      } else {
        await api(`/admin/events/${eventId}/cases`, { method: 'POST', body });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={caseRow ? `Edit Case — ${caseRow.title}` : 'New Case'} wide>
      <form onSubmit={save} className="space-y-4">
        <Field label="Case title">
          <InputBare required value={f.title} onChange={set('title')} />
        </Field>
        <Field label="Plot (shown to teams; also the closing context)">
          <textarea
            className="w-full rounded-md border border-edge bg-surface px-3 py-2 text-sm text-ink focus:border-mark focus:outline-none focus:ring-2 focus:ring-mark/25"
            rows={4}
            value={f.plot}
            onChange={set('plot')}
          />
        </Field>

        <div className="space-y-3 rounded-md border border-edge p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">Closing challenge</p>
          <Field label="Accepted answers (one per line)">
            <textarea
              className="w-full rounded-md border border-edge bg-surface px-3 py-2 font-mono text-sm text-ink focus:border-mark focus:outline-none focus:ring-2 focus:ring-mark/25"
              rows={3}
              value={answersText}
              onChange={(e) => setAnswersText(e.target.value)}
              placeholder="bakerstreet"
            />
          </Field>
          <div className="flex flex-wrap items-center gap-5 text-sm">
            <label className="flex items-center gap-2 text-ink-soft">
              <input type="checkbox" checked={f.closing.caseInsensitive} onChange={(e) => setF((p) => ({ ...p, closing: { ...p.closing, caseInsensitive: e.target.checked } }))} />
              Case insensitive
            </label>
            <label className="flex items-center gap-2 text-ink-soft">
              <input type="checkbox" checked={f.closing.normalize} onChange={(e) => setF((p) => ({ ...p, closing: { ...p.closing, normalize: e.target.checked } }))} />
              Normalize whitespace
            </label>
            <label className="flex items-center gap-2 text-ink-soft">
              <input type="checkbox" checked={f.published} onChange={(e) => setF((p) => ({ ...p, published: e.target.checked }))} /> Published
            </label>
          </div>
          <Field label="Regex override (optional)">
            <InputBare value={f.closing.regex} onChange={setClosing('regex')} className="font-mono" placeholder="e.g. ^MP\\d{4}$" />
          </Field>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {(['first', 'second', 'third', 'participation']).map((k) => (
            <Field key={k} label={k === 'participation' ? 'Participation' : `Podium #${k === 'first' ? 1 : k === 'second' ? 2 : 3}`}>
              <InputBare type="number" min={0} value={f.podium[k]} onChange={setPodium(k)} />
            </Field>
          ))}
        </div>

        {error && <Alert tone="danger">{error}</Alert>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : caseRow ? 'Save Case' : 'Create Case'}</Button>
        </div>
      </form>
    </Dialog>
  );
}

export default function AdminCases() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [cases, setCases] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [busyAction, setBusyAction] = useState(null);

  const load = useCallback(async () => {
    try {
      setCases((await api(`/admin/events/${eventId}/cases`)).cases.sort((a, b) => a.order - b.order));
    } catch (e) {
      setError(e.message);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  function move(i, dir) {
    setCases((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next.map((c, idx) => ({ ...c, order: idx + 1 }));
    });
  }

  async function saveOrder() {
    setSavingOrder(true);
    try {
      await api(`/admin/events/${eventId}/cases/reorder`, { method: 'PUT', body: { orderedCaseIds: cases.map((c) => c.id) } });
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingOrder(false);
    }
  }

  async function progress(c, action) {
    setBusyAction(`${c.id}:${action}`);
    try {
      await api(`/admin/cases/${c.id}/${action}`, { method: 'POST' });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyAction(null);
    }
  }

  async function togglePublish(c) {
    try {
      await api(`/admin/cases/${c.id}/publish`, { method: 'PUT', body: { published: !c.published } });
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function remove(c) {
    if (!window.confirm(`Delete case “${c.title}” and its sub-files?`)) return;
    try {
      await api(`/admin/cases/${c.id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  if (error) return <ErrorState error={error} />;
  if (!cases) return <PageState message="Loading cases…" />;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-type text-2xl text-ink">Cases</h1>
          <p className="text-sm text-ink-faint">
            Admin opens one Case at a time; teams solve its sub-files, then close it for the podium bonus.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={saveOrder} disabled={savingOrder}>
            <Save className="h-4 w-4" /> Save order
          </Button>
          <Button onClick={() => { setEditing(null); setEditorOpen(true); }}>
            <Plus className="h-4 w-4" /> New Case
          </Button>
        </div>
      </div>

      {error && <Alert tone="danger" className="mb-3">{error}</Alert>}

      <div className="space-y-2">
        {cases.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-ink-faint">No cases yet.</CardContent>
          </Card>
        )}
        {cases.map((c, i) => (
          <Card key={c.id}>
            <CardContent className="flex items-center gap-3">
              <div className="flex flex-col">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="p-0.5 text-ink-faint hover:text-ink disabled:opacity-30">
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button onClick={() => move(i, 1)} disabled={i === cases.length - 1} className="p-0.5 text-ink-faint hover:text-ink disabled:opacity-30">
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
              <div className="mr-1 hidden min-w-6 text-center sm:block">
                <span className="font-mono text-xs text-ink-faint">#{c.order}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{c.title}</p>
                <p className="text-xs text-ink-faint">
                  {c.subFileCount} sub-files · {c.closureCount} closing{c.closureCount === 1 ? '' : 's'}
                </p>
              </div>
              <Badge tone={STATUS_TONE[c.status] || 'default'}>{c.status}</Badge>
              <Badge tone={c.published ? 'success' : 'default'}>{c.published ? 'published' : 'draft'}</Badge>
              <div className="flex gap-1">
                {c.status === 'LOCKED' && (
                  <Button size="sm" onClick={() => progress(c, 'start')} disabled={busyAction === `${c.id}:start`}>
                    <Play className="h-4 w-4" /> Start
                  </Button>
                )}
                {c.status === 'OPEN' && (
                  <Button size="sm" variant="danger" onClick={() => progress(c, 'close')} disabled={busyAction === `${c.id}:close`}>
                    <Square className="h-4 w-4" /> Close
                  </Button>
                )}
                <Button size="sm" variant="ghost" title="Sub-files" onClick={() => navigate(`/admin/events/${eventId}/cases/${c.id}/files`)}>
                  <FileText className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" title="Edit case" onClick={() => { setEditing(c); setEditorOpen(true); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" title="Publish/draft" onClick={() => togglePublish(c)}>
                  <span className="text-xs font-medium">{c.published ? 'Draft' : 'Publish'}</span>
                </Button>
                {!c.closureCount && (
                  <Button size="sm" variant="ghost" title="Delete" onClick={() => remove(c)}>
                    <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <CaseEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        eventId={eventId}
        caseRow={editing}
        onSaved={load}
      />
    </div>
  );
}