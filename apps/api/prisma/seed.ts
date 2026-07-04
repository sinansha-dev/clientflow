import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('Admin123!', 12);

  await prisma.user.upsert({
    where: { email: 'admin@clientflow.local' },
    update: {
      firstName: 'ClientFlow',
      lastName: 'Admin',
      password,
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
      deletedAt: null,
    },
    create: {
      firstName: 'ClientFlow',
      lastName: 'Admin',
      email: 'admin@clientflow.local',
      password,
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
