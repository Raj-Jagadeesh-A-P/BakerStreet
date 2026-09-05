export default {
  title: 'The Contributor',
  order: 5,
  type: 'USERNAME',
  story:
    'The commit has been identified. Now the trail leads to a person: the author who pushed that first change into the open-source world.',
  question:
    'What is the GitHub username of the author who made the very first commit in this repository?\n\nInvestigation Target: Commit Author',
  githubUrl: 'https://github.com/react/react/commit/75897c2dcd1dd3a6ca46284dd37e13d22b4b16b4',
  points: 100,
  wrongPenalty: 5,
  caseInsensitive: true,
  normalize: true,
  answers: [{ value: 'zpao' }],
  hints: [
    { title: 'Hint 1', text: 'Open the first commit. Click the author avatar to open his GitHub profile.', cost: 10 },
    { title: 'Hint 2', text: 'The username is four characters and begins with the letter z. He was a core React maintainer at Facebook.', cost: 20 },
  ],
  evidence: [{ label: 'Contributor', value: '{{answer}}' }],
};