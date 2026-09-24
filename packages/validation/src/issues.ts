import type { z } from 'zod';

/** Groups Zod issues by dotted field path, using `_root` for object-level issues. */
export function issuesByField(error: z.ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length === 0 ? '_root' : issue.path.map(String).join('.');
    (fields[key] ??= []).push(issue.message);
  }

  return fields;
}
