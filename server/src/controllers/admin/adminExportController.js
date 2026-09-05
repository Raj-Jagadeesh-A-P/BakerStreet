import { AppError, asyncHandler } from '../../middleware/errors.js';
import { MESSAGES } from '../../config.js';
import { toCsv } from '../../utils/csv.js';
import { events, cases, teams, subs, finals } from '../../db/repo.js';

const TYPES = ['participants', 'teams', 'scores', 'submissions', 'finals'];

export const exportCsv = asyncHandler(async (req, res) => {
  const eventId = req.params.id;
  const type = req.params.type;
  if (!TYPES.includes(type)) throw new AppError(404, MESSAGES.notFound);

  const event = await events.get(eventId);
  if (!event) throw new AppError(404, MESSAGES.notFound);

  const filename = `${event.code}-${type}.csv`;
  let rows = [];

  if (type === 'participants') {
    const teamRows = await teams.list(eventId);
    const members = [];
    for (const t of teamRows) {
      const m = await teams.members(t.id);
      for (const member of m) {
        members.push({
          team: t,
          member,
          createdAt: member.createdAt,
        });
      }
    }
    members.sort((a, b) => (a.team.name < b.team.name ? -1 : 1) || String(a.member.id).localeCompare(String(b.member.id)));
    rows = members.map((m, i) => ({
      'Sl No': i + 1,
      Name: m.member.name,
      Email: m.member.email,
      Team: m.team.name,
      'Joined At': m.createdAt?.toISOString?.() ?? '',
    }));
  } else if (type === 'teams' || type === 'scores') {
    const [teamRows, solvedCounts, finalRows] = await Promise.all([
      teams.list(eventId),
      subs.solvedCounts(eventId),
      finals.list(eventId),
    ]);
    const finalByTeam = new Map(finalRows.map((f) => [f.teamId, f]));
    rows = [];
    for (let i = 0; i < teamRows.length; i++) {
      const t = teamRows[i];
      const members = await teams.members(t.id);
      const fin = finalByTeam.get(t.id);
      rows.push({
        Rank: i + 1,
        'Team Name': t.name,
        'Team Code': t.code,
        Score: t.score,
        'Cases Solved': solvedCounts.get(t.id) || 0,
        Members: members.map((m) => m.name).join(', '),
        'Member Emails': members.map((m) => m.email).join(', '),
        'Final Status': fin?.status ?? '-',
        'Final Score': fin?.totalScore ?? '-',
      });
    }
  } else if (type === 'submissions') {
    const rowsList = await subs.listForEvent(eventId);
    rows = [];
    for (const s of rowsList) {
      const [team, caseRow] = await Promise.all([teams.get(s.teamId), cases.get(s.caseId)]);
      rows.push({
        'Submission ID': s.id,
        Team: team?.name ?? '?',
        Case: caseRow?.title ?? '?',
        Answer: s.answer,
        Correct: s.correct ? 'Yes' : 'No',
        Timestamp: s.createdAt?.toISOString?.() ?? '',
      });
    }
  } else if (type === 'finals') {
    const finalRows = await finals.list(eventId);
    rows = [];
    for (const f of finalRows) {
      const team = await teams.get(f.teamId);
      rows.push({
        Team: team?.name ?? '?',
        'Suspected Contributor': f.suspectedContributor,
        'Commit SHA': f.commitSha,
        'Related Issue': f.relatedIssue,
        'Related PR': f.relatedPr,
        'What Happened': f.whatHappened,
        'Proposed Fix': f.fix,
        Evidence: f.evidenceExplanation,
        Status: f.status,
        'Total Score': f.totalScore ?? '',
        Breakdown: f.breakdown ? JSON.stringify(f.breakdown) : '',
        Attachment: f.attachmentPath ?? '',
        'Submitted At': f.createdAt?.toISOString?.() ?? '',
      });
    }
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(toCsv(rows));
});