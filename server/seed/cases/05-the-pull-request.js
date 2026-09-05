export default {
  title: 'The Pull Request',
  order: 6,
  type: 'NUMBER',
  story:
    'The trail moves forward in time. One of the most influential changes to React — the introduction of Hooks — began life as a proposal, and proposals live in pull requests.',
  question:
    'Which pull request in the reactjs/rfcs repository is titled "RFC: React Hooks"?\n\nGive the pull request number.',
  githubUrl: 'https://github.com/reactjs/rfcs/pulls',
  points: 120,
  wrongPenalty: 5,
  caseInsensitive: true,
  normalize: true,
  answers: [{ value: '68' }, { value: '068' }],
  hints: [
    { title: 'Hint 1', text: 'Open the Pull Requests tab of reactjs/rfcs and search for "React Hooks". Look at both open and closed requests.', cost: 10 },
    { title: 'Hint 2', text: 'Filter pull requests by author "sebmarkbage" and locate the one merged in November 2018.', cost: 20 },
  ],
  evidence: [{ label: 'Pull Request', value: '#{{answer}}' }],
};