import type { PrismaClient } from '../src/index.js';
import { catalogSnapshot } from './catalog-data.js';

/** Seeds the two-level category tree and returns category ids keyed by slug. */
export async function seedCategories(prisma: PrismaClient): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  const parents = catalogSnapshot.categories.filter((category) => category.parent === null);
  const children = catalogSnapshot.categories.filter((category) => category.parent !== null);

  for (const category of [...parents, ...children]) {
    const parentId = category.parent === null ? null : ids.get(category.parent);
    if (parentId === undefined) {
      throw new Error(`Seed category ${category.slug} references an unknown parent.`);
    }

    const created = await prisma.category.create({
      data: {
        name: category.name,
        slug: category.slug,
        description: category.description,
        image: category.image,
        sortOrder: category.sortOrder,
        parentId,
      },
      select: { id: true },
    });
    ids.set(category.slug, created.id);
  }

  return ids;
}
