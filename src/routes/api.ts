import { Router } from 'express';
import { 
  createAlertHandler, 
  getAlertsHandler, 
  deleteAlertHandler, 
  updateAlertHandler 
} from '../controllers/alertController.js';

const router = Router();

router.post('/alerts', createAlertHandler);
router.get('/alerts', getAlertsHandler);
router.put('/alerts/:id', updateAlertHandler);
router.delete('/alerts/:id', deleteAlertHandler);

export default router;