export default {
  title: 'The Commit',
  order: 4,
  type: 'COMMIT_SHA',
  story:
    'Every repository has a beginning. Evidence suggests the culprit is connected to the very first change ever recorded in this repository — the moment the investigation log begins.',
  question:
    'What is the full 40-character SHA of the very first commit in this repository?\n\nInvestigation Target: Commit History',
  githubUrl: 'https://github.com/react/react/commits/main',
  points: 120,
  wrongPenalty: 5,
  caseInsensitive: true,
  normalize: true,
  answers: [{ value: '75897c2dcd1dd3a6ca46284dd37e13d22b4b16b4' }],
  hints: [
    { title: 'Hint 1', text: 'Open the Commits tab of the repository. The very first entry at the bottom of the history is the initial commit — check its date.', cost: 10 },
    { title: 'Hint 2', text: 'Clone the repository with git and run: git log --oneline --all --reverse | head -1, then copy the full SHA.', cost: 20 },
  ],
  evidence: [{ label: 'Commit', value: '{{answer}}' }],
};