const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('123456', 10);
  const user = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      username: 'admin',
      passwordHash: hash,
      role: 'ADMIN',
      firstName: 'Admin',
      lastName: 'User',
      isActive: true,
    }
  });
  console.log('Admin user created:', user.email, '| role:', user.role, '| id:', user.id);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e.message);
  await prisma.$disconnect();
  process.exit(1);
});
