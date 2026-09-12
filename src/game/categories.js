export const CATEGORIES = [
  { key: 'name', label: 'Name' },
  { key: 'place', label: 'Place' },
  { key: 'animal', label: 'Animal' },
  { key: 'thing', label: 'Thing' },
];

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);

export const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));