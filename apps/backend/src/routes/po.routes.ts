import { Router } from 'express';
import multer from 'multer';
import poController from '../controllers/po.controller';
import clientController from '../controllers/client.controller';

const router: Router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.post('/upload', upload.single('file'), poController.uploadPO);
router.get('/', poController.getPOs);
router.get('/clients', clientController.listClients);
router.post('/clients', clientController.upsertClient);
router.get('/:poNumber/pdf', poController.streamPOPdf);
router.get('/:poNumber', poController.getPOByNumber);
router.put('/:poNumber', poController.updatePO);
router.delete('/:poNumber', poController.deletePO);

export default router;