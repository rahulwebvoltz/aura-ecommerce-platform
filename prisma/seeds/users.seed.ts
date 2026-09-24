import { faker } from '@faker-js/faker';
import argon2 from 'argon2';

import type { PrismaClient } from '../src/index.js';

export const DEMO_CUSTOMER = {
  email: 'demo@example.com',
  password: 'Demo@12345',
  firstName: 'Aarav',
  lastName: 'Sharma',
} as const;

export const DEMO_ADMIN = {
  email: 'admin@example.com',
  password: 'Admin@12345',
  firstName: 'Store',
  lastName: 'Admin',
} as const;

const EXTRA_CUSTOMERS = 8;

export interface SeededUsers {
  demoCustomerId: string;
  adminId: string;
  /** Customers other than the demo account, used as review authors. */
  customerIds: string[];
}

export async function seedUsers(prisma: PrismaClient): Promise<SeededUsers> {
  faker.seed(2026);
  const [demoHash, adminHash, sharedHash] = await Promise.all([
    argon2.hash(DEMO_CUSTOMER.password, { type: argon2.argon2id }),
    argon2.hash(DEMO_ADMIN.password, { type: argon2.argon2id }),
    argon2.hash('Customer@12345', { type: argon2.argon2id }),
  ]);

  const demo = await prisma.user.create({
    data: {
      email: DEMO_CUSTOMER.email,
      passwordHash: demoHash,
      firstName: DEMO_CUSTOMER.firstName,
      lastName: DEMO_CUSTOMER.lastName,
      phone: '+91 98765 43210',
      emailVerified: true,
    },
  });

  const admin = await prisma.user.create({
    data: {
      email: DEMO_ADMIN.email,
      passwordHash: adminHash,
      firstName: DEMO_ADMIN.firstName,
      lastName: DEMO_ADMIN.lastName,
      role: 'ADMIN',
      emailVerified: true,
    },
  });

  const customers = Array.from({ length: EXTRA_CUSTOMERS }, (_, index) => {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    return {
      email: `${firstName}.${lastName}.${String(index + 1)}@example.com`
        .toLowerCase()
        .replace(/[^a-z0-9.@]/gu, ''),
      passwordHash: sharedHash,
      firstName,
      lastName,
      emailVerified: index % 3 !== 0,
    };
  });
  const created = await prisma.user.createManyAndReturn({
    data: customers,
    select: { id: true },
  });

  await prisma.address.createMany({
    data: [
      {
        userId: demo.id,
        firstName: DEMO_CUSTOMER.firstName,
        lastName: DEMO_CUSTOMER.lastName,
        phone: '+91 98765 43210',
        addressLine1: '221B, 12th Main Road',
        addressLine2: 'Indiranagar',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560038',
        country: 'IN',
        isDefault: true,
      },
      {
        userId: demo.id,
        firstName: DEMO_CUSTOMER.firstName,
        lastName: DEMO_CUSTOMER.lastName,
        phone: '+91 91234 56789',
        addressLine1: 'Level 5, One BKC',
        addressLine2: 'Bandra Kurla Complex',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400051',
        country: 'IN',
        isDefault: false,
      },
    ],
  });

  return {
    demoCustomerId: demo.id,
    adminId: admin.id,
    customerIds: created.map((user) => user.id),
  };
}
