export default {
  title: 'Final Case — The Broken Release',
  order: 8,
  finalCase: true,
  type: 'TEXT',
  story:
    'The investigation culminates here. Organizers will provide a dedicated BakerStreet repository that has a broken release. This is an open investigation — no one tells you where to look.\n\nDetermine:\n\n1. What is broken?\n2. Which commit introduced the problem?\n3. Who made the change?\n4. Which issue or pull request is connected to it?\n5. How would you fix it?\n\nInspect the README, issues, pull requests, commits, files, contributors and releases on your own.',
  question:
    'Submit the Final Investigation form with your findings. A judge will evaluate your work on:\n\n- Contributor identified (+100)\n- Commit identified (+100)\n- Issue identified (+75)\n- Pull request identified (+75)\n- Root cause identified (+100)\n- Proposed fix (+100)\n- Evidence quality (+50)\n\nTotal: 600 points',
  githubUrl: 'https://github.com',
  points: 500,
  wrongPenalty: 0,
  caseInsensitive: true,
  normalize: true,
  answers: [],
  hints: [],
  evidence: [{ label: 'Final Investigation', value: 'Submitted — awaiting judgment' }],
};