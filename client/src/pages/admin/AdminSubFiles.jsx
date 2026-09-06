import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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

export default function AdminSubFiles() {
  const { eventId, caseId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [files, setFiles] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [savingOrder, setSavingOrder] = useState(false);

  const load = useCallback(async () => {
    try {
      setFiles((await api(`/admin/events/${eventId}/cases/${caseId}/files`)).files.sort((a, b) => a.order - b.order));
    } catch (e) {
      setError(e.message);
    }
  }, [eventId, caseId]);

  useEffect(() => {
    load();
  }, [load]);

  function move(i, dir) {
    setFiles((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next.map((f, idx) => ({ ...f, order: idx + 1 }));
    });
  }

  async function saveOrder() {
    setSavingOrder(true);
    try {
      await api(`/admin/events/${eventId}/cases/${caseId}/files/reorder`, {
        method: 'PUT',
        body: { orderedFileIds: files.map((f) => f.id) },
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingOrder(false);
    }
  }

  async function togglePublish(f) {
    try {
      await api(`/admin/cases/${caseId}/subfiles/${f.id}/publish`, { method: 'PUT', body: { published: !f.published } });
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function remove(f) {
    if (!window.confirm(`Delete sub-file “${f.title}”?`)) return;
    try {
      await api(`/admin/cases/${caseId}/subfiles/${f.id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  if (error) return <ErrorState error={error} />;
  if (!files) return <PageState message="Loading sub-files…" />;

  useEffect(() => {
    if (!data) {
      api(`/admin/events/${eventId}/cases`)
        .then((res) => setData(res.cases.find((c) => c.id === caseId) || null))
        .catch(() => {});
    }
  }, [data, eventId, caseId]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <button className="text-xs font-mono text-ink-faint underline" onClick={() => navigate(`/admin/events/${eventId}/cases`)}>
            ← Cases
          </button>
          <h1 className="mt-1 font-type text-2xl text-ink">
            {data ? `${data.title} — Sub-Files` : 'Sub-Files'}
          </h1>
          <p className="text-sm text-ink-faint">Unlock is strictly in order; teams must solve each sub-file before the next appears.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={saveOrder} disabled={savingOrder}>
            <Save className="h-4 w-4" /> Save order
          </Button>
          <Button onClick={() => { setEditing(null); setEditorOpen(true); }}>
            <Plus className="h-4 w-4" /> New Sub-File
          </Button>
        </div>
      </div>

      {error && <Alert tone="danger" className="mb-3">{error}</Alert>}

      <div className="space-y-2">
        {files.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-ink-faint">
              No sub-files yet. Add the first puzzle below.
            </CardContent>
          </Card>
        )}
        {files.map((f, i) => (
          <Card key={f.id}>
            <CardContent className="flex items-center gap-3">
              <div className="flex flex-col">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="p-0.5 text-ink-faint hover:text-ink disabled:opacity-30">
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button onClick={() => move(i, 1)} disabled={i === files.length - 1} className="p-0.5 text-ink-faint hover:text-ink disabled:opacity-30">
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
              <div className="mr-1 hidden min-w-6 text-center sm:block">
                <span className="font-mono text-xs text-ink-faint">#{f.order}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{f.title}</p>
                <p className="text-xs text-ink-faint">
                  {f.points} pts · −{f.wrongPenalty} wrong · {f.maxAttempts ?? '∞'} attempts · {f.answers.length} answers · {f.hints.length} hints
                </p>
              </div>
              <Badge tone={f.published ? 'success' : 'default'}>{f.published ? 'published' : 'draft'}</Badge>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" title="Preview" onClick={() => setPreview(f)}>
                  <Eye className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" title="Edit" onClick={() => { setEditing(f); setEditorOpen(true); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" title="Publish/draft" onClick={() => togglePublish(f)}>
                  <span className="text-xs font-medium">{f.published ? 'Draft' : 'Publish'}</span>
                </Button>
                <Button size="sm" variant="ghost" title="Delete" onClick={() => remove(f)}>
                  <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <CaseEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        eventId={eventId}
        caseId={caseId}
        fileRow={editing}
        onSaved={load}
      />

      <Dialog open={!!preview} onClose={() => setPreview(null)} title={`Preview — ${preview?.title}`} wide>
        {preview && <CasePreview c={preview} />}
      </Dialog>
    </div>
  );
}