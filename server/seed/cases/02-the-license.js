export default {
  title: 'The License',
  order: 3,
  type: 'TEXT',
  story:
    'The repository is confirmed. Before the investigation moves further, you must verify the legal terms under which it is distributed. The license on file will be part of your final report.',
  question:
    'What is the SPDX license identifier shown on this repository?\n\nTip: The license is listed in the repository sidebar and in its LICENSE file.',
  githubUrl: 'https://github.com/react/react',
  points: 100,
  wrongPenalty: 5,
  caseInsensitive: true,
  normalize: true,
  answers: [{ value: 'MIT' }, { value: 'MIT License' }, { value: 'mit' }],
  hints: [
    { title: 'Hint 1', text: 'Open the LICENSE file at the root of the repository.', cost: 10 },
    { title: 'Hint 2', text: 'The proven contributor checked the sidebar: the identifier starts with the letter M.', cost: 20 },
  ],
  evidence: [{ label: 'License', value: '{{answer}}' }],
};