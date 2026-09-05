import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as event from '../controllers/eventController.js';
import * as caseCtrl from '../controllers/caseController.js';
import * as leaderboard from '../controllers/leaderboardController.js';
import * as evidence from '../controllers/evidenceController.js';
import * as final from '../controllers/finalController.js';

const router = Router();

router.post('/events/join', authenticate, ...event.joinByCode);
router.get('/events/:id', authenticate, event.getEvent);
router.get('/events/:id/dashboard', authenticate, event.dashboard);

router.post('/events/:id/teams', authenticate, ...event.createTeam);
router.post('/events/:id/teams/join', authenticate, ...event.joinTeam);

router.get('/cases/:id', authenticate, caseCtrl.getCase);
router.post('/cases/:id/submit', authenticate, ...caseCtrl.submit);
router.post('/cases/:id/hints/:hintId/use', authenticate, caseCtrl.useHint);

router.get('/events/:id/leaderboard', authenticate, leaderboard.leaderboard);

router.get('/teams/:id/evidence', authenticate, evidence.getEvidence);

router.post('/final/submit', authenticate, ...final.submitFinal);

export default router;