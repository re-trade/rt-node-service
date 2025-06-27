import { createClient } from 'redis';
import configLoader from './config-loader.js';

export const redisClient = createClient({
  url: configLoader.config.REDIS_URL,
});

redisClient.on('error', err => console.error('Redis error:', err));

(async () => {
  try {
    await redisClient.connect();
    console.log('Redis connected successfully');
  } catch (error) {
    console.error('Redis connection error:', error);
  }
})();
