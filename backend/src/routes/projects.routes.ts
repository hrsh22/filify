import { Router } from 'express';
import { projectsController } from '../controllers/projects.controller';
import { deploymentsController } from '../controllers/deployments.controller';
import { isAuthenticated } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { createProjectSchema, updateProjectSchema } from '../utils/validators';

const router = Router();

router.get('/', isAuthenticated, (req, res) => projectsController.list(req, res));
router.post(
  '/',
  isAuthenticated,
  validateRequest(createProjectSchema),
  (req, res) => projectsController.create(req, res)
);
router.get('/:id', isAuthenticated, (req, res) => projectsController.getById(req, res));
router.put(
  '/:id',
  isAuthenticated,
  validateRequest(updateProjectSchema),
  (req, res) => projectsController.update(req, res)
);
router.delete('/:id', isAuthenticated, (req, res) => projectsController.delete(req, res));
router.get('/:id/deployments', isAuthenticated, (req, res) =>
  deploymentsController.listByProject(req, res)
);

export default router;




