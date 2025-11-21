import { Router } from 'express';
import { deploymentsController } from '../controllers/deployments.controller';
import { isAuthenticated } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { createDeploymentSchema, updateENSSchema } from '../utils/validators';
import { deploymentLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post(
    '/',
    isAuthenticated,
    deploymentLimiter,
    validateRequest(createDeploymentSchema),
    (req, res) => deploymentsController.create(req, res)
);

router.post(
    '/:id/ens',
    isAuthenticated,
    validateRequest(updateENSSchema),
    (req, res) => deploymentsController.updateENS(req, res)
);

router.get('/:id', isAuthenticated, (req, res) => deploymentsController.getStatus(req, res));
router.get('/:id/artifact', isAuthenticated, (req, res) => deploymentsController.downloadArtifact(req, res));
router.post('/:id/cancel', isAuthenticated, (req, res) => deploymentsController.cancel(req, res));

export default router;

