import {Router} from 'express';
import poController from '../controllers/po.controller';

const router : Router = Router();

router.get('/', poController.getPOs);

export default router;