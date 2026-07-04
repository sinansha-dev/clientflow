import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { authRoutes } from './routes/auth.routes';
import { userRoutes } from './routes/user.routes';
import { env } from './config/env';
import { cookieSecret } from './utils/cookies';
import { errorMiddleware } from './middleware/error';
import { requestLogger } from './middleware/request-logger';

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.WEB_ORIGIN,
    credentials: true,
  }),
);
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser(cookieSecret));
app.use(requestLogger);

app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'ClientFlow API is healthy' });
});

app.use('/auth', authRoutes);
app.use('/users', userRoutes);

app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found', errors: [] });
});
app.use(errorMiddleware);
