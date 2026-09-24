import type { DatabaseClient } from '@ecommerce/db';
import type { CategoryDetailDto, CategoryDto } from '@ecommerce/types';

import { notFound } from '../../utils/errors.js';
import { groupCount } from '../../utils/prisma.js';

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  parentId: string | null;
  sortOrder: number;
}

export function createCategoriesService(prisma: DatabaseClient) {
  async function loadTree(): Promise<{ roots: CategoryDto[]; byId: Map<string, CategoryDto> }> {
    const [rows, counts] = await prisma.$transaction([
      prisma.category.findMany({
        where: { status: 'ACTIVE' },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          image: true,
          parentId: true,
          sortOrder: true,
        },
      }),
      prisma.product.groupBy({
        by: ['categoryId'],
        where: { status: 'ACTIVE' },
        orderBy: { categoryId: 'asc' },
        _count: { _all: true },
      }),
    ]);

    const countFor = new Map(counts.map((entry) => [entry.categoryId, groupCount(entry._count)]));
    const byId = new Map<string, CategoryDto>(
      rows.map((row: CategoryRow) => [
        row.id,
        {
          id: row.id,
          name: row.name,
          slug: row.slug,
          description: row.description,
          image: row.image,
          parentId: row.parentId,
          productCount: countFor.get(row.id) ?? 0,
          children: [],
        },
      ]),
    );

    const roots: CategoryDto[] = [];
    for (const category of byId.values()) {
      const parent = category.parentId === null ? undefined : byId.get(category.parentId);
      if (category.parentId === null) {
        roots.push(category);
      } else if (parent !== undefined) {
        parent.children.push(category);
      }
    }
    // Parents show the total of their own and their children's products.
    for (const root of roots) {
      root.productCount += root.children.reduce((sum, child) => sum + child.productCount, 0);
    }

    return { roots, byId };
  }

  return {
    async tree(): Promise<CategoryDto[]> {
      return (await loadTree()).roots;
    },

    async bySlug(slug: string): Promise<CategoryDetailDto> {
      const { byId } = await loadTree();
      const category = [...byId.values()].find((entry) => entry.slug === slug);
      if (category === undefined) {
        throw notFound('Category');
      }

      const parent = category.parentId === null ? undefined : byId.get(category.parentId);
      const breadcrumbs = [parent, category]
        .filter((entry): entry is CategoryDto => entry !== undefined)
        .map(({ id, name, slug: entrySlug }) => ({ id, name, slug: entrySlug }));

      return { ...category, breadcrumbs };
    },

    /** The category and all its descendants, or null when the slug is unknown or inactive. */
    async idsForSlug(slug: string): Promise<string[] | null> {
      const category = await prisma.category.findFirst({
        where: { slug, status: 'ACTIVE' },
        select: { id: true, children: { where: { status: 'ACTIVE' }, select: { id: true } } },
      });

      return category === null ? null : [category.id, ...category.children.map(({ id }) => id)];
    },
  };
}

export type CategoriesService = ReturnType<typeof createCategoriesService>;
