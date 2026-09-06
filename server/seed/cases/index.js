// Seed packs for the BakerStreet investigation. Each definition is one parent
// Case: a briefing (`plot`), a set of ordered sub-files (the Q&A puzzles) and a
// closing challenge (a final answer that is auto-checked, with podium bonuses
// for the first three teams that close it).
import file00 from './00-the-warm-up.js';
import file01 from './01-the-unknown-repository.js';
import file02 from './02-the-license.js';
import file03 from './03-the-commit.js';
import file04 from './04-the-contributor.js';
import file05 from './05-the-pull-request.js';
import file06 from './06-the-connection.js';

// Case Definitions

const GENESIS = {
  title: 'Genesis',
  order: 1,
  plot:
    'The first case files survive in a single repository. Confirm the entry password to the investigation, then identify the project behind it. Once you are sure of the suspect, close the case with a verdict.',
  closing: {
    answers: ['react', 'facebook/react', 'react/react'],
    caseInsensitive: true,
    normalize: true,
    regex: null,
  },
  podium: {},
  files: [
    { ...file00, order: 1 },
    { ...file01, order: 2 },
  ],
};

const EARLY_DAYS = {
  title: 'The Early Days',
  order: 2,
  plot:
    'The trail moves to the beginning of the project: how it was licensed, the very first commit, and the person behind it. Trace the early contributors and close the case with the author of the first commit.',
  closing: {
    answers: ['zpao'],
    caseInsensitive: true,
    normalize: true,
    regex: null,
  },
  podium: {},
  files: [
    { ...file02, order: 1 },
    { ...file03, order: 2 },
    { ...file04, order: 3 },
  ],
};

const HOOKS = {
  title: 'The Hooks Proposal',
  order: 3,
  plot:
    'The final arc: a proposal that changed everything. Find the RFC pull request and the engineer behind it, then close the case by naming what was proposed.',
  closing: {
    answers: ['hooks', 'react hooks'],
    caseInsensitive: true,
    normalize: true,
    regex: null,
  },
  podium: {},
  files: [
    { ...file05, order: 1 },
    { ...file06, order: 2 },
  ],
};

export const caseDefinitions = [GENESIS, EARLY_DAYS, HOOKS].sort((a, b) => a.order - b.order);