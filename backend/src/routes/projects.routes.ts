import { Router } from 'express';
import { projectsController } from '../controllers/projects.controller';
import { deploymentsController } from '../controllers/deployments.controller';
import { isAuthenticated } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { createProjectSchema, updateProjectSchema, webhookToggleSchema, emptyBodySchema } from '../utils/validators';

const router: Router = Router();

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
router.post(
  '/:id/webhook/enable',
  isAuthenticated,
  validateRequest(webhookToggleSchema),
  (req, res) => projectsController.enableWebhook(req, res)
);
router.post(
  '/:id/webhook/disable',
  isAuthenticated,
  validateRequest(emptyBodySchema),
  (req, res) => projectsController.disableWebhook(req, res)
);

// ENS Management Routes
router.post(
  '/:id/ens/attach',
  isAuthenticated,
  (req, res) => projectsController.attachEns(req, res)
);

router.post(
  '/:id/ens/confirm',
  isAuthenticated,
  (req, res) => projectsController.confirmEnsAttach(req, res)
);

router.delete(
  '/:id/ens',
  isAuthenticated,
  (req, res) => projectsController.removeEns(req, res)
);

router.post(
  '/:id/github/relink',
  isAuthenticated,
  (req, res) => projectsController.relinkGithub(req, res)
);

export default router;




