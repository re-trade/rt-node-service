import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import http from 'http';
import configLoader from './configs/config-loader.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { createRoutes } from './routes/index.js';

const PORT = configLoader.config.PORT || 3000;
const CORS_ORIGIN = configLoader.config.CORS_ORIGIN || 'http://localhost:3000';

const app = express();
const httpServer = http.createServer(app);

app.use(helmet());
app.use(compression() as any);
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

console.log('🚀 Initializing services...');

app.use('/api', createRoutes(httpServer, CORS_ORIGIN));

app.use(notFoundHandler);
app.use(errorHandler);

httpServer.listen(PORT, () => {
  console.log('🎉 RT Node Service started successfully!');
  console.log(`📡 Server running on port: ${PORT}`);
  console.log(`🌐 CORS origin: ${CORS_ORIGIN}`);
  console.log(`🔗 API endpoints: http://localhost:${PORT}/api`);
  console.log(`📚 Documentation: http://localhost:${PORT}/api/docs`);
  console.log(`💬 Socket.IO chat service: Ready`);
  console.log(`📹 WebRTC signaling service: Ready`);
  console.log('');
  console.log('Services available:');
  console.log('  - Real-time chat with Socket.IO');
  console.log('  - WebRTC signaling for video/audio calls');
  console.log('  - RESTful API for service management');
  console.log('');
});

process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
});

export default app;
