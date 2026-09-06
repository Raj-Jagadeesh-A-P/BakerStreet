import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as event from '../controllers/eventController.js';
import * as subFile from '../controllers/subFileController.js';
import * as closing from '../controllers/closingController.js';
import * as leaderboard from '../controllers/leaderboardController.js';
import * as evidence from '../controllers/evidenceController.js';

const router = Router();

router.post('/events/join', authenticate, ...event.joinByCode);
router.get('/events/:id', authenticate, event.getEvent);
router.get('/events/:id/dashboard', authenticate, event.dashboard);

router.post('/events/:id/teams', authenticate, ...event.createTeam);
router.post('/events/:id/teams/join', authenticate, ...event.joinTeam);

router.get('/events/:eid/cases/:cid', authenticate, subFile.getCase);
router.get('/events/:eid/cases/:cid/files/:fid', authenticate, subFile.getFile);
router.post('/events/:eid/cases/:cid/files/:fid/submit', authenticate, ...subFile.submitFile);
router.post('/events/:eid/cases/:cid/files/:fid/hints/:hintId/use', authenticate, subFile.useHint);
router.post('/events/:eid/cases/:cid/close', authenticate, ...closing.submitClosing);

router.get('/events/:id/leaderboard', authenticate, leaderboard.leaderboard);

router.get('/teams/:id/evidence', authenticate, evidence.getEvidence);

export default router;