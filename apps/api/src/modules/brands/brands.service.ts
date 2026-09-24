import type { DatabaseClient } from '@ecommerce/db';
import type { BrandDto } from '@ecommerce/types';

import { notFound } from '../../utils/errors.js';

const brandSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  logo: true,
  _count: { select: { products: { where: { status: 'ACTIVE' } } } },
} as const;

function toBrand(row: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo: string | null;
  _count: { products: number };
}): BrandDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    logo: row.logo,
    productCount: row._count.products,
  };
}

export function createBrandsService(prisma: DatabaseClient) {
  return {
    async list(): Promise<BrandDto[]> {
      const rows = await prisma.brand.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { name: 'asc' },
        select: brandSelect,
      });

      return rows.map(toBrand);
    },

    async bySlug(slug: string): Promise<BrandDto> {
      const row = await prisma.brand.findFirst({
        where: { slug, status: 'ACTIVE' },
        select: brandSelect,
      });
      if (row === null) {
        throw notFound('Brand');
      }

      return toBrand(row);
    },
  };
}
