import { cases, evidence, subs } from '../db/repo.js';

// Renders evidence for the team's solved cases. Evidence templates may contain
// {{answer}}, substituted with the team's own correct answer.
export async function teamEvidenceRows(teamId, eventId) {
  const [solved, caseRows] = await Promise.all([subs.solvedForTeam(teamId), cases.list(eventId)]);

  const answers = new Map(solved.map((s) => [s.caseId, s.answer]));
  const rows = [];
  for (const c of caseRows) {
    if (!answers.has(c.id)) continue;
    const evRows = await evidence.list(c.id);
    for (const e of evRows) {
      rows.push({
        caseOrder: c.order,
        caseTitle: c.title,
        label: e.label,
        value: String(e.value).replaceAll('{{answer}}', String(answers.get(c.id) ?? '')),
      });
    }
  }
  return rows;
}