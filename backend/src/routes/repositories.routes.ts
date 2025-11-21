import { Router } from 'express';
import { repositoriesController } from '../controllers/repositories.controller';
import { isAuthenticated } from '../middleware/auth';

const router = Router();

router.get('/', isAuthenticated, (req, res) => repositoriesController.list(req, res));
router.get('/:owner/:repo/branches', isAuthenticated, (req, res) =>
    repositoriesController.getBranches(req, res)
);

export default router;



