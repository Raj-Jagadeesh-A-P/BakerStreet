import { cases, evidence, subs, subfiles } from '../db/repo.js';

// Renders evidence for the team's solved sub-files. Evidence templates may
// contain {{answer}}, substituted with the team's own correct answer.
export async function teamEvidenceRows(teamId, eventId) {
  const [solved, caseRows] = await Promise.all([subs.solvedForEventTeam(eventId, teamId), cases.list(eventId)]);

  const answers = new Map(solved.map((s) => [s.fileId, s.answer]));
  const rows = [];
  for (const c of caseRows) {
    const files = await subfiles.list(c.id);
    for (const f of files) {
      if (!answers.has(f.id)) continue;
      const evRows = await evidence.list(c.id, f.id);
      for (const e of evRows) {
        rows.push({
          caseOrder: c.order,
          caseTitle: c.title,
          fileTitle: f.title,
          label: e.label,
          value: String(e.value).replaceAll('{{answer}}', String(answers.get(f.id) ?? '')),
        });
      }
    }
  }
  return rows;
}