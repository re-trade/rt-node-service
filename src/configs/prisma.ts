import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
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
