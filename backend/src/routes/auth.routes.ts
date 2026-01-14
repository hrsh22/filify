import { Router } from 'express';
import { authController } from '../controllers/auth.controller';

const router: Router = Router();

router.post('/nonce', (req, res) => authController.getNonce(req, res));
router.post('/verify', (req, res) => authController.verify(req, res));
router.get('/user', (req, res) => authController.getUser(req, res));
router.post('/logout', (req, res) => authController.logout(req, res));
router.get('/status', (req, res) => authController.getStatus(req, res));

export default router;
