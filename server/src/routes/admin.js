import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import * as adminEvent from '../controllers/admin/adminEventController.js';
import * as adminCase from '../controllers/admin/adminCaseController.js';
import * as adminTeam from '../controllers/admin/adminTeamController.js';
import * as adminSub from '../controllers/admin/adminSubmissionController.js';
import * as adminClosing from '../controllers/admin/adminClosingController.js';
import * as adminExport from '../controllers/admin/adminExportController.js';

const router = Router();

router.get('/events', authenticate, requireAdmin, adminEvent.listEvents);
router.post('/events', authenticate, requireAdmin, ...adminEvent.createEvent);
router.get('/events/:id', authenticate, requireAdmin, adminEvent.getEvent);
router.put('/events/:id', authenticate, requireAdmin, ...adminEvent.updateEvent);
router.post('/events/:id/start', authenticate, requireAdmin, adminEvent.startEvent);
router.post('/events/:id/pause', authenticate, requireAdmin, adminEvent.pauseEvent);
router.post('/events/:id/end', authenticate, requireAdmin, adminEvent.endEvent);
router.post('/events/:id/reset', authenticate, requireAdmin, adminEvent.resetEvent);

router.get('/events/:id/cases', authenticate, requireAdmin, adminCase.listCases);
router.post('/events/:id/cases', authenticate, requireAdmin, ...adminCase.createCase);
router.put('/cases/:id', authenticate, requireAdmin, ...adminCase.updateCase);
router.delete('/cases/:id', authenticate, requireAdmin, adminCase.deleteCase);
router.put('/cases/:id/publish', authenticate, requireAdmin, ...adminCase.setPublished);
router.put('/events/:id/cases/reorder', authenticate, requireAdmin, ...adminCase.reorderCases);
router.post('/cases/:id/start', authenticate, requireAdmin, adminCase.startCase);
router.post('/cases/:id/close', authenticate, requireAdmin, adminCase.closeCase);

router.get('/events/:id/cases/:caseId/files', authenticate, requireAdmin, adminCase.listFiles);
router.post('/events/:id/cases/:caseId/files', authenticate, requireAdmin, ...adminCase.createFile);
router.put('/cases/:cid/subfiles/:fid', authenticate, requireAdmin, ...adminCase.updateFile);
router.delete('/cases/:cid/subfiles/:fid', authenticate, requireAdmin, adminCase.deleteFile);
router.put('/cases/:cid/subfiles/:fid/publish', authenticate, requireAdmin, ...adminCase.setFilePublished);
router.put('/events/:id/cases/:caseId/files/reorder', authenticate, requireAdmin, ...adminCase.reorderFiles);

router.get('/events/:id/teams', authenticate, requireAdmin, adminTeam.listTeams);
router.delete('/teams/:id', authenticate, requireAdmin, adminTeam.deleteTeam);

router.get('/events/:id/submissions', authenticate, requireAdmin, adminSub.listSubmissions);

router.get('/events/:id/closings', authenticate, requireAdmin, adminClosing.listClosings);

router.get('/events/:id/export/:type', authenticate, requireAdmin, adminExport.exportCsv);

export default router;