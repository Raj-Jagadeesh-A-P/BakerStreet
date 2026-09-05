import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card.jsx';
import { Badge } from '../../components/ui/badge.jsx';
import { InputBare } from '../../components/ui/input.jsx';

export default function CasePreview({ c }) {
  const [ans, setAns] = useState('');
  const isMC = c.type === 'MULTIPLE_CHOICE';

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="noir-texture border-b border-edge bg-solid px-5 py-4 text-white">
          <div className="flex items-center gap-2">
            <p className="font-type text-xs tracking-[0.3em] text-mark-bright/80">
              Case #{c.order} · {c.type}
            </p>
            {c.finalCase && <Badge tone="danger">FINAL</Badge>}
          </div>
          <h3 className="mt-1 font-type text-xl">{c.title}</h3>
          <div className="mt-1 flex items-center gap-3 font-mono text-xs text-white/60">
            <span>{c.points} pts · −{c.wrongPenalty} wrong · {c.maxAttempts ?? '∞'} attempts</span>
            {c.githubUrl && (
              <a href={c.githubUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline hover:text-white">
                View repository <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
        <CardContent className="space-y-4">
          <p className="whitespace-pre-wrap font-type text-[15px] leading-7 text-ink-soft">{c.story}</p>
          <p className="whitespace-pre-wrap rounded-md border border-edge bg-surface/60 p-3 font-type text-[15px] leading-7 text-ink">{c.question}</p>

          <div>
            <p className="mb-1 font-type text-xs tracking-[0.2em] text-ink-faint">Your answer</p>
            {isMC ? (
              <div className="space-y-1">
                {(c.options?.options || []).map((o, i) => (
                  <label key={i} className={`block cursor-pointer rounded-md border px-3 py-2 text-sm text-ink ${ans === o ? 'border-mark bg-mark/10' : 'border-edge hover:bg-ink/5'}`}>
                    <input type="radio" name="mc" value={o} className="mr-2" checked={ans === o} onChange={() => setAns(o)} />
                    {o}
                  </label>
                ))}
              </div>
            ) : (
              <InputBare value={ans} onChange={(e) => setAns(e.target.value)} placeholder="Answer is validated server-side" disabled className="bg-ink/5" />
            )}
          </div>

          <div>
            <p className="mb-1 font-type text-xs tracking-[0.2em] text-ink-faint">Hints (revealed only after “Use Hint”, cost points)</p>
            {c.hints.length === 0 ? (
              <p className="text-sm text-ink-faint">No hints.</p>
            ) : (
              <div className="space-y-1">
                {c.hints.map((h) => (
                  <div key={h.id} className="flex items-center justify-between rounded-md border border-edge px-3 py-2 text-sm">
                    <span className="text-ink">{h.title}</span>
                    <span className="font-mono text-xs text-ink-faint">−{h.cost} pts</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}