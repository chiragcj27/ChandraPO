import { Router } from 'express';
import multer from 'multer';
import poController from '../controllers/po.controller';
import clientController from '../controllers/client.controller';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router: Router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// All PO routes require authentication
router.use(authenticate);

// Upload is admin only
router.post('/upload', requireAdmin, upload.single('file'), poController.uploadPO);
// Delete is admin only (handled in controller as well, but middleware enforces it)
router.delete('/:poNumber', requireAdmin, poController.deletePO);

// Other routes - accessible by authenticated users (admin or client with proper filtering)
router.get('/', poController.getPOs);
router.get('/clients', requireAdmin, clientController.listClients);
router.post('/clients', requireAdmin, clientController.upsertClient);
router.get('/:poNumber/pdf', poController.streamPOPdf);
router.get('/:poNumber/items', poController.getPOItems); // Optimized endpoint for items page
router.get('/:poNumber', poController.getPOByNumber);
// Update PO - admin only (clients have view-only access)
router.put('/:poNumber', requireAdmin, poController.updatePO);

export default router;