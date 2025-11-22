import { Router } from 'express';
import { deploymentsController } from '../controllers/deployments.controller';
import { isAuthenticated } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import {
    createDeploymentSchema,
    prepareENSSchema,
    confirmENSSchema,
    uploadFailureSchema,
} from '../utils/validators';

const router = Router();

router.post(
    '/',
    isAuthenticated,
    validateRequest(createDeploymentSchema),
    (req, res) => deploymentsController.create(req, res)
);

router.post(
    '/:id/ens/prepare',
    isAuthenticated,
    validateRequest(prepareENSSchema),
    (req, res) => deploymentsController.prepareENS(req, res)
);
router.post(
    '/:id/ens/confirm',
    isAuthenticated,
    validateRequest(confirmENSSchema),
    (req, res) => deploymentsController.confirmENS(req, res)
);
router.post(
    '/:id/upload/fail',
    isAuthenticated,
    validateRequest(uploadFailureSchema),
    (req, res) => deploymentsController.markUploadFailed(req, res)
);

router.get('/', isAuthenticated, (req, res) => deploymentsController.list(req, res));
router.get('/:id', isAuthenticated, (req, res) => deploymentsController.getStatus(req, res));
router.get('/:id/artifacts', isAuthenticated, (req, res) => deploymentsController.downloadArtifacts(req, res));
router.get('/:id/artifact', isAuthenticated, (req, res) => deploymentsController.downloadArtifacts(req, res)); // legacy path
router.post('/:id/cancel', isAuthenticated, (req, res) => deploymentsController.cancel(req, res));

export default router;

