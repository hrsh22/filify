import { Router } from 'express';
import { githubController } from '../controllers/github.controller';
import { isAuthenticated } from '../middleware/auth';

const router: Router = Router();

router.get('/install', isAuthenticated, (req, res) => githubController.getInstallUrl(req, res));
router.get('/callback', (req, res) => githubController.handleCallback(req, res));
router.get('/installations', isAuthenticated, (req, res) => githubController.listInstallations(req, res));
router.delete('/installations/:id', isAuthenticated, (req, res) => githubController.removeInstallation(req, res));
router.get('/repos', isAuthenticated, (req, res) => githubController.listRepos(req, res));
router.get('/installations/:installationId/repos/:owner/:repo/branches', isAuthenticated, (req, res) => githubController.listBranches(req, res));

export default router;
