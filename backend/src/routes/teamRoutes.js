import express from 'express';
import { getTeams, getTeamById } from '../controllers/teamController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/', getTeams);
router.get('/:id', getTeamById);

export default router;
