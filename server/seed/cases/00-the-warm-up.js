export default {
  title: 'The Warm-Up',
  order: 1,
  type: 'TEXT',
  story:
    'A sealed envelope sits on the evidence table. The flap is stamped with a single word — the password to enter the BakerStreet investigation. No repository, no commits, no clues to hunt. Just type the word that unlocks the case files.',
  question:
    'What is the one-word password to enter the investigation?\n\nType your answer below.',
  points: 50,
  wrongPenalty: 2,
  caseInsensitive: true,
  normalize: true,
  answers: [{ value: 'bakerstreet' }],
  hints: [
    { title: 'Hint 1', text: 'It is the name of this event, all lowercase, one word.', cost: 10 },
    { title: 'Hint 2', text: 'B-a-k-e-r-S-t-r-e-e-t.', cost: 20 },
  ],
  evidence: [{ label: 'Access Code', value: '{{answer}}' }],
};