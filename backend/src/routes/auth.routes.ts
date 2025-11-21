import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authLimiter } from '../middleware/rateLimiter';

const router = Router();

router.get('/github', authLimiter, (req, res) => authController.githubAuth(req, res));
router.get('/github/callback', authLimiter, (req, res) => authController.githubCallback(req, res));
router.get('/user', (req, res) => authController.getUser(req, res));
router.post('/logout', (req, res) => authController.logout(req, res));
router.get('/status', (req, res) => authController.getStatus(req, res));

export default router;




