import { Router } from 'express';
import { ensController } from '../controllers/ens.controller';

const router = Router();

// GET /api/ens/domains/:address - Get ENS domains owned by an address
router.get('/domains/:address', (req, res) => ensController.getDomains(req, res));

export default router;
