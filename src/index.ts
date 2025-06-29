import configLoader from 'configs/config-loader.js';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import http from 'http';
import morgan from 'morgan';
import { prisma } from './configs/prisma.js';
import { redisClient } from './configs/redis.js';
import { createRouter } from './routes/index.js';

const PORT = configLoader.config.PORT;
const CORS_ORIGIN = configLoader.config.CORS_ORIGIN;

const app = express();
const server = http.createServer(app);
app.use(
  cors({
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const router = createRouter(server, CORS_ORIGIN);
app.use('/api', router);

app.use((err: any, req: any, res: any, next: any) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

async function shutdown() {
  console.log('🛑 Shutting down gracefully...');

  try {
    await new Promise(resolve => {
      server.close(() => resolve(true));
    });
    console.log('✅ HTTP server closed');

    await prisma.$disconnect();
    console.log('✅ Database connection closed');
    await redisClient.quit();
    console.log('✅ Redis connection closed');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error during shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

server.listen(PORT, () => {
  console.log('🚀 RT Node Service started successfully!');
  console.log(`📡 Server running on port: ${PORT}`);
  console.log(`🌐 CORS origin: ${CORS_ORIGIN}`);
  console.log('');
  console.log('Services available:');
  console.log('💬 Chat service: Ready');
  console.log('📹 Video call service: Ready');
  console.log('');
  console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
});
