import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merges class names, letting later Tailwind utilities win over earlier ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const dateFormatter = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' });
const dateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}

/** Human label for a variant, e.g. "Black · 128GB". */
export function formatAttributes(attributes: Record<string, string> | null | undefined): string {
  return attributes === null || attributes === undefined
    ? ''
    : Object.values(attributes).join(' · ');
}

/** Title-cases an attribute or enum key: "storage" → "Storage", "IN_PROGRESS" → "In progress". */
export function humanize(value: string): string {
  const spaced = value.replace(/[_-]+/gu, ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${String(count)} ${count === 1 ? singular : plural}`;
}

/** Random key for idempotent requests, safe in every supported browser. */
export function idempotencyKey(): string {
  return crypto.randomUUID();
}
