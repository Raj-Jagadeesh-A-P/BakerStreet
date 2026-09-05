export default {
  title: 'The Connection',
  order: 7,
  type: 'USERNAME',
  story:
    'Your evidence is complete, but one thread still binds the case together. The pull request you found was authored by an engineer who went on to lead React. Identifying them completes the connection.',
  question:
    'What is the GitHub username of the author of the "RFC: React Hooks" pull request?\n\nInvestigation Target: Pull Request Author',
  githubUrl: 'https://github.com/reactjs/rfcs/pull/68',
  points: 100,
  wrongPenalty: 5,
  caseInsensitive: true,
  normalize: true,
  answers: [{ value: 'sebmarkbage' }],
  hints: [
    { title: 'Hint 1', text: 'Open the pull request and check the Author badge in the top-right corner.', cost: 10 },
    { title: 'Hint 2', text: 'The username is based on the name of a Swedish town.', cost: 20 },
  ],
  evidence: [{ label: 'Related Contributor', value: '{{answer}}' }],
};