export default {
  title: 'The Unknown Repository',
  order: 2,
  type: 'GITHUB_REPOSITORY',
  story:
    'A mysterious file has surfaced in the evidence room. It describes a library used by millions of developers to build modern web interfaces, but the name of its repository has been redacted.\n\nYour task is to identify the repository that changed modern web development forever.',
  question:
    'What is the full name of the repository (in owner/repo format)?\n\nInvestigation Target: GitHub Repository',
  githubUrl: 'https://github.com/react/react',
  points: 100,
  wrongPenalty: 5,
  caseInsensitive: true,
  normalize: true,
  answers: [{ value: 'react/react' }, { value: 'facebook/react' }],
  hints: [
    { title: 'Hint 1', text: 'Open the repository page and read the About section in the right-hand panel.', cost: 10 },
    { title: 'Hint 2', text: 'The repository describes itself as "The library for web and native user interfaces".', cost: 20 },
  ],
  evidence: [{ label: 'Repository', value: '{{answer}}' }],
};