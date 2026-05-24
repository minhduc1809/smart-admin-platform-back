import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { domain: 'default' },
    create: { name: 'Default Organization', domain: 'default' },
    update: {},
  });

  console.log(`Tenant ready: ${tenant.name} (${tenant.id})`);

  const adminEmail = 'admin@example.com';

  const existing = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: adminEmail },
  });
  if (existing) {
    console.log(`User ${adminEmail} already exists, skipping.`);
    return;
  }

  const passwordHash = await bcrypt.hash('123456', 10);

  const admin = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: adminEmail,
      username: 'admin',
      passwordHash,
      role: Role.ADMIN,
      firstName: 'Admin',
      lastName: 'System',
      isActive: true,
    },
  });

  console.log(`Created admin user: ${admin.email} (${admin.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
