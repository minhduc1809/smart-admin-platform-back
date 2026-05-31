/**
 * Create a new tenant with admin user.
 *
 * Usage:
 *   npx ts-node prisma/create-tenant.ts "Tên đơn vị" "domain-slug" "admin@email.com" "password"
 *
 * Example:
 *   npx ts-node prisma/create-tenant.ts "Đại học Bách Khoa Hà Nội" "hust" "admin@hust.edu.vn" "Admin@12345"
 */

import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const [,, tenantName, domain, adminEmail, password] = process.argv;

  if (!tenantName || !adminEmail || !password) {
    console.log(`
Tạo tenant mới cho FlowForm

Cách dùng:
  npx ts-node prisma/create-tenant.ts <tên đơn vị> <domain> <email admin> <mật khẩu>

Ví dụ:
  npx ts-node prisma/create-tenant.ts "Đại học Bách Khoa" "hust" "admin@hust.edu.vn" "Admin@12345"
  npx ts-node prisma/create-tenant.ts "Trường ĐH FPT" "fpt" "admin@fpt.edu.vn" "Admin@12345"

Tenant hiện có:`);

    const tenants = await prisma.tenant.findMany({
      include: { _count: { select: { users: true, forms: true, submissions: true } } },
    });
    tenants.forEach((t) => {
      console.log(`  ${t.name} (${t.domain}) — ${t._count.users} users, ${t._count.forms} forms, ${t._count.submissions} submissions`);
    });
    return;
  }

  // Create tenant
  const tenant = await prisma.tenant.upsert({
    where: { domain: domain || tenantName.toLowerCase().replace(/\s+/g, '-') },
    create: {
      name: tenantName,
      domain: domain || tenantName.toLowerCase().replace(/\s+/g, '-'),
    },
    update: { name: tenantName },
  });
  console.log(`\nTenant: ${tenant.name} (${tenant.id})`);

  // Create admin user
  const hash = await bcrypt.hash(password, 10);
  const existing = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: adminEmail.toLowerCase() },
  });

  if (existing) {
    console.log(`Admin đã tồn tại: ${existing.email}`);
  } else {
    const admin = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: adminEmail.toLowerCase(),
        username: adminEmail.split('@')[0],
        passwordHash: hash,
        role: Role.ADMIN,
        firstName: 'Admin',
        lastName: tenantName,
        isActive: true,
      },
    });
    console.log(`Admin tạo mới: ${admin.email} (role: ADMIN)`);
  }

  console.log(`
Đăng nhập:
  Email: ${adminEmail}
  Mật khẩu: ${password}
  Tenant ID: ${tenant.id}

Gửi header "x-tenant-id: ${tenant.id}" trong mọi request API.
Hoặc cấu hình frontend để tự động gửi tenant ID.
`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
