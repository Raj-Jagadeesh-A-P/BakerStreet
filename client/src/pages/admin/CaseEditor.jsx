import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../../api.js';
import { Dialog } from '../../components/ui/dialog.jsx';
import { Button } from '../../components/ui/button.jsx';
import { InputBare, Field } from '../../components/ui/input.jsx';
import { Alert } from '../../components/ui/alert.jsx';

const TYPES = ['TEXT', 'NUMBER', 'URL', 'GITHUB_REPOSITORY', 'COMMIT_SHA', 'USERNAME', 'MULTIPLE_CHOICE'];

function ListEditor({ title, items, onChange, renderItem, placeholder, schema }) {
  const [rows, setRows] = useState(items);
  useEffect(() => setRows(items), [items]);

  function update(i, patch) {
    const next = rows.map((r, j) => (j === i ? { ...r, ...patch } : r));
    setRows(next);
    onChange(next);
  }
  function remove(i) {
    const next = rows.filter((_, j) => j !== i);
    setRows(next);
    onChange(next);
  }
  function add() {
    const next = [...rows, schema()];
    setRows(next);
    onChange(next);
  }

  return (
    <div className="rounded-md border border-edge p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-ink-faint">{title}</span>
        <Button type="button" size="sm" variant="outline" onClick={add}>
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>
      <div className="space-y-2">
        {rows.length === 0 && <p className="text-xs text-ink-faint">None yet.</p>}
        {rows.map((row, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="grid flex-1 gap-2">{renderItem(row, (patch) => update(i, patch), placeholder)}</div>
            <Button type="button" size="sm" variant="ghost" onClick={() => remove(i)} className="h-8 w-8 p-0">
              <Trash2 className="h-4 w-4 text-red-400" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CaseEditor({ open, onClose, eventId, caseRow, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [f, setF] = useState({});
  const [answers, setAnswers] = useState([]);
  const [hints, setHints] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [optionsText, setOptionsText] = useState('');

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (caseRow) {
      setF({
        title: caseRow.title,
        type: caseRow.type,
        story: caseRow.story,
        question: caseRow.question,
        githubUrl: caseRow.githubUrl ?? '',
        points: caseRow.points,
        wrongPenalty: caseRow.wrongPenalty,
        maxAttempts: caseRow.maxAttempts ?? '',
        caseInsensitive: caseRow.caseInsensitive,
        normalize: caseRow.normalize,
        regex: caseRow.regex ?? '',
        finalCase: caseRow.finalCase,
        published: caseRow.published,
      });
      setAnswers(caseRow.answers.map((a) => a.value));
      setHints(caseRow.hints.map((h) => ({ title: h.title, text: h.text, cost: h.cost })));
      setEvidence(caseRow.evidence.map((e) => ({ label: e.label, value: e.value })));
      setOptionsText(caseRow.options?.options?.join('\n') ?? '');
    } else {
      setF({
        title: '', type: 'TEXT', story: '', question: '', githubUrl: '',
        points: 100, wrongPenalty: 5, maxAttempts: '', caseInsensitive: true, normalize: true,
        regex: '', finalCase: false, published: true,
      });
      setAnswers([]);
      setHints([]);
      setEvidence([]);
      setOptionsText('');
    }
  }, [open, caseRow]);

  function set(k) {
    return (e) => setF((prev) => ({ ...prev, [k]: e.target.value }));
  }
  function flag(k, e) {
    return (e2) => setF((prev) => ({ ...prev, [k]: e2.target.checked }));
  }

  async function save(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const body = {
      ...f,
      maxAttempts: f.maxAttempts === '' || f.maxAttempts === null ? null : Number(f.maxAttempts),
      points: Number(f.points),
      wrongPenalty: Number(f.wrongPenalty),
      answers: answers.map((v) => ({ value: v })).filter((a) => a.value.trim()),
      hints: hints.map((h) => ({ title: h.title, text: h.text, cost: Number(h.cost) || 10 })),
      evidence: evidence.map((ev) => ({ label: ev.label, value: ev.value })),
      options: f.type === 'MULTIPLE_CHOICE' ? { options: optionsText.split('\n').map((s) => s.trim()).filter(Boolean) } : null,
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

  const hintPlaceholder = {
    renderItem: (row, update) => (
      <>
        <InputBare value={row.title} onChange={(e) => update({ title: e.target.value })} placeholder="Hint title" />
        <InputBare value={row.text} onChange={(e) => update({ text: e.target.value })} placeholder="Hint text" />
        <InputBare value={row.cost} onChange={(e) => update({ cost: e.target.value })} placeholder="Cost (-points)" className="w-28" />
      </>
    ),
  };

  return (
    <Dialog open={open} onClose={onClose} title={caseRow ? `Edit Case — ${caseRow.title}` : 'New Case'}>
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title">
            <InputBare required value={f.title} onChange={set('title')} />
          </Field>
          <Field label="Answer Type">
            <select className="h-10 rounded-md border border-edge bg-surface px-3 text-sm text-ink" value={f.type} onChange={set('type')}>
              {TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Story">
          <textarea className="w-full rounded-md border border-edge bg-surface px-3 py-2 text-sm text-ink focus:border-mark focus:outline-none focus:ring-2 focus:ring-mark/25" rows={4} value={f.story} onChange={set('story')} />
        </Field>
        <Field label="Question">
          <textarea className="w-full rounded-md border border-edge bg-surface px-3 py-2 text-sm text-ink focus:border-mark focus:outline-none focus:ring-2 focus:ring-mark/25" rows={3} value={f.question} onChange={set('question')} />
        </Field>
        <Field label="GitHub URL">
          <InputBare type="url" value={f.githubUrl} onChange={set('githubUrl')} placeholder="https://github.com/…" />
        </Field>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Points">
            <InputBare type="number" min={0} value={f.points} onChange={set('points')} />
          </Field>
          <Field label="Wrong penalty">
            <InputBare type="number" min={0} value={f.wrongPenalty} onChange={set('wrongPenalty')} />
          </Field>
          <Field label="Max attempts">
            <InputBare type="number" min={0} value={f.maxAttempts} onChange={set('maxAttempts')} placeholder="∞" />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-5 text-sm">
          <label className="flex items-center gap-2 text-ink-soft">
            <input type="checkbox" checked={f.caseInsensitive} onChange={flag('caseInsensitive')} /> Case insensitive
          </label>
          <label className="flex items-center gap-2 text-ink-soft">
            <input type="checkbox" checked={f.normalize} onChange={flag('normalize')} /> Normalize whitespace
          </label>
          <label className="flex items-center gap-2 text-ink-soft">
            <input type="checkbox" checked={f.finalCase} onChange={flag('finalCase')} /> Final case
          </label>
          <label className="flex items-center gap-2 text-ink-soft">
            <input type="checkbox" checked={f.published} onChange={flag('published')} /> Published
          </label>
        </div>

        <Field label="Regex (optional override)">
          <InputBare value={f.regex} onChange={set('regex')} placeholder="e.g. ^[a-f0-9]{40}$" className="font-mono" />
        </Field>

        {f.type === 'MULTIPLE_CHOICE' && (
          <Field label="Options (one per line)">
            <textarea className="w-full rounded-md border border-edge bg-surface px-3 py-2 font-mono text-sm text-ink focus:border-mark focus:outline-none focus:ring-2 focus:ring-mark/25" rows={4} value={optionsText} onChange={(e) => setOptionsText(e.target.value)} />
          </Field>
        )}

        <ListEditor
          title="Accepted answers"
          items={answers}
          onChange={setAnswers}
          placeholder="Answer value"
          schema={() => ''}
          renderItem={(v, update) => <InputBare value={v} onChange={(e) => update(e.target.value)} placeholder="Accepted answer" className="font-mono" />}
        />

        <ListEditor
          title="Hints"
          items={hints}
          onChange={setHints}
          schema={() => ({ title: '', text: '', cost: 10 })}
          {...hintPlaceholder}
        />

        <ListEditor
          title="Evidence"
          items={evidence}
          onChange={setEvidence}
          schema={() => ({ label: '', value: '' })}
          renderItem={(row, update) => (
            <>
              <InputBare value={row.label} onChange={(e) => update({ label: e.target.value })} placeholder="Label (e.g. Repository)" />
              <InputBare value={row.value} onChange={(e) => update({ value: e.target.value })} placeholder="Value (use {{answer}} to insert the team’s answer)" className="font-mono" />
            </>
          )}
        />

        {error && <Alert tone="danger">{error}</Alert>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : caseRow ? 'Save Case' : 'Create Case'}</Button>
        </div>
      </form>
    </Dialog>
  );
}