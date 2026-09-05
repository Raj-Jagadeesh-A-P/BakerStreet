// Case packs for the event seed. Add/remove files here to change the cases a
// new environment is seeded with — each file exports one case definition.
import case00 from './00-the-warm-up.js';
import case01 from './01-the-unknown-repository.js';
import case02 from './02-the-license.js';
import case03 from './03-the-commit.js';
import case04 from './04-the-contributor.js';
import case05 from './05-the-pull-request.js';
import case06 from './06-the-connection.js';
import case07 from './07-final-case-the-broken-release.js';

// Ordered by `order`; kept explicit so file numbering can diverge from play order.
export const caseSeed = [case00, case01, case02, case03, case04, case05, case06, case07].sort(
  (a, b) => a.order - b.order,
);