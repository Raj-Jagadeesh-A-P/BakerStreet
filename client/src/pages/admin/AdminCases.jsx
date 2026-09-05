import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Eye, Pencil, Trash2, ChevronUp, ChevronDown, Plus, Save } from 'lucide-react';
import { api } from '../../api.js';
import { Button } from '../../components/ui/button.jsx';
import { Card, CardContent } from '../../components/ui/card.jsx';
import { Badge } from '../../components/ui/badge.jsx';
import { Dialog } from '../../components/ui/dialog.jsx';
import { Alert } from '../../components/ui/alert.jsx';
import { PageState, ErrorState } from '../../components/ui/state.jsx';
import CaseEditor from './CaseEditor.jsx';
import CasePreview from './CasePreview.jsx';

export default function AdminCases() {
  const { eventId } = useParams();
  const [cases, setCases] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [savingOrder, setSavingOrder] = useState(false);

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

  async function togglePublish(c) {
    try {
      await api(`/admin/cases/${c.id}/publish`, { method: 'PUT', body: { published: !c.published } });
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function remove(c) {
    if (!window.confirm(`Delete case “${c.title}”? This also removes its submissions and scores.`)) return;
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
          <p className="text-sm text-ink-faint">Order controls unlocking. Only published cases are playable.</p>
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
                <p className="truncate font-semibold text-ink">
                  {c.title}
                  {c.finalCase && <Badge tone="danger" className="ml-2">FINAL</Badge>}
                  <span className="ml-2 font-mono text-xs text-ink-faint">{c.type}</span>
                </p>
                <p className="text-xs text-ink-faint">
                  {c.points} pts · −{c.wrongPenalty} wrong · {c.maxAttempts ?? '∞'} attempts · {c.answers.length} answers · {c.hints.length} hints
                </p>
              </div>
              <Badge tone={c.published ? 'success' : 'default'}>{c.published ? 'published' : 'draft'}</Badge>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" title="Preview" onClick={() => setPreview(c)}>
                  <Eye className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" title="Edit" onClick={() => { setEditing(c); setEditorOpen(true); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" title="Publish/draft" onClick={() => togglePublish(c)}>
                  <span className="text-xs font-medium">{c.published ? 'Draft' : 'Publish'}</span>
                </Button>
                {!c.solvedCount && (
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

      <Dialog open={!!preview} onClose={() => setPreview(null)} title={`Preview — ${preview?.title}`} wide>
        {preview && <CasePreview c={preview} />}
      </Dialog>
    </div>
  );
}