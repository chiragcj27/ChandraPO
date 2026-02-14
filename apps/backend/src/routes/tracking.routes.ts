import { Router } from 'express';
import multer from 'multer';
import trackingController from '../controllers/tracking.controller';

const router: Router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit for Excel files
  fileFilter: (_req, file, cb) => {
    // Accept Excel files
    if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.endsWith('.xlsx') ||
      file.originalname.endsWith('.xls')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
    }
  },
});

// Tracking routes are public (no authentication required)
router.post('/upload', upload.single('file'), trackingController.uploadTrackingExcel);
router.get('/', trackingController.getAllTrackings);
router.get('/:trackingId', trackingController.getTrackingDetails);
router.post('/:trackingId/refresh', trackingController.refreshTracking);
router.delete('/:trackingId', trackingController.deleteTracking);

export default router;

