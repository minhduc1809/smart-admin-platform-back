const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Ensure a default tenant exists
  const tenant = await prisma.tenant.upsert({
    where: { domain: 'default.local' },
    update: {},
    create: {
      name: 'Default Tenant',
      domain: 'default.local',
      isActive: true,
    }
  });

  const hash = await bcrypt.hash('123456', 10);
  const user = await prisma.user.upsert({
    where: { 
      tenantId_email: {
        tenantId: tenant.id,
        email: 'admin@example.com'
      }
    },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'admin@example.com',
      username: 'admin',
      passwordHash: hash,
      role: 'ADMIN',
      firstName: 'Admin',
      lastName: 'User',
      isActive: true,
    }
  });
  console.log('Admin user ready:', user.email, '| role:', user.role, '| id:', user.id, '| tenantId:', user.tenantId);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e.message);
  await prisma.$disconnect();
  process.exit(1);
});
