import { PrismaClient } from '@prisma/client';
import configLoader from './config-loader.js';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: configLoader.config.DATABASE_URL,
    },
  },
});
prisma
  .$connect()
  .then(() => {
    console.log('Prisma connected successfully');
  })
  .catch((error: Error) => {
    console.error('Prisma connection error:', error);
  })
  .finally(() => {
    process.on('exit', () => {
      prisma.$disconnect();
    });
  });

export { prisma };
