import express from 'express';
import {
  getItems,
  getItemById,
  createItem,
  updateItem,
  claimItem,
  transitionItem,
  getActivity,
  getComments,
  addComment,
} from '../controllers/workItemController.js';
import { protect } from '../middleware/auth.js';
import { requireIdempotency } from '../middleware/idempotency.js';
import { validateBody } from '../middleware/validate.js';
import {
  createWorkItemSchema,
  updateWorkItemSchema,
  transitionSchema,
  commentSchema,
} from '../validations/schemas.js';

const router = express.Router();

router.use(protect);

router.get('/', getItems);
router.post('/', requireIdempotency, validateBody(createWorkItemSchema), createItem);
router.get('/:id', getItemById);
router.patch('/:id', validateBody(updateWorkItemSchema), updateItem);
router.post('/:id/claim', claimItem);
router.post('/:id/transition', validateBody(transitionSchema), transitionItem);
router.get('/:id/activity', getActivity);
router.get('/:id/comments', getComments);
router.post('/:id/comments', validateBody(commentSchema), addComment);

export default router;
