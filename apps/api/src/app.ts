import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { authRoutes } from './routes/auth.routes';
import { userRoutes } from './routes/user.routes';
import { clientRoutes } from './routes/client.routes';
import { projectRoutes } from './routes/project.routes';
import { taskRoutes, labelRoutes } from './routes/task.routes';
import { teamRoutes } from './routes/team.routes';
import { timelogRoutes, timerRoutes } from './routes/timelog.routes';
import { meetingRoutes, calendarRoutes } from './routes/meeting.routes';
import {
  portalRoutes,
  fileRoutes,
  folderRoutes,
  approvalRoutes,
  revisionRoutes,
  messageRoutes,
} from './routes/portal.routes';
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

// Serve uploads folder static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'ClientFlow API is healthy' });
});

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/clients', clientRoutes);
app.use('/projects', projectRoutes);
app.use('/tasks', taskRoutes);
app.use('/labels', labelRoutes);
app.use('/team', teamRoutes);
app.use('/timelogs', timelogRoutes);
app.use('/timer', timerRoutes);
app.use('/meetings', meetingRoutes);
app.use('/calendar', calendarRoutes);
app.use('/portal', portalRoutes);
app.use('/files', fileRoutes);
app.use('/folders', folderRoutes);
app.use('/approvals', approvalRoutes);
app.use('/revisions', revisionRoutes);
app.use('/messages', messageRoutes);

app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found', errors: [] });
});
app.use(errorMiddleware);
