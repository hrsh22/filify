import { Router, raw } from 'express';
import { webhooksController } from '../controllers/webhooks.controller';

const router = Router();

router.post('/github', raw({ type: '*/*' }), (req, res) =>
    webhooksController.handleGithubWebhook(req, res)
);

export default router;



