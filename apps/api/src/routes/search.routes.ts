import { Router } from 'express';
import { searchController } from '../controllers/search.controller';
import { requireAuth } from '../middleware/auth';

export const searchRoutes = Router();

searchRoutes.use(requireAuth);

searchRoutes.get('/', (req, res, next) => searchController.search(req, res).catch(next));
