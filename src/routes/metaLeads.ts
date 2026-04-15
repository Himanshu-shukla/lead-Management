import { Router } from 'express';
import { receiveMetaLeadWebhook, verifyMetaLeadWebhook } from '../controllers/metaLeadController';

const router = Router();

router.get('/', verifyMetaLeadWebhook);
router.post('/', receiveMetaLeadWebhook);

export default router;
