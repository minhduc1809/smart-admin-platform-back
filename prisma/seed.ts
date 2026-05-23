import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@example.com';

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    console.log(`User ${adminEmail} already exists, skipping.`);
    return;
  }

  const passwordHash = await bcrypt.hash('123456', 10);

  const admin = await prisma.user.create({
    data: {
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
