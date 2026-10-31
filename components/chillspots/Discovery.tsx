import type { Sort } from '@/lib/discovery';

export type Page = 'explore' | 'saved' | 'settings';
export const sortLabels: Record<Sort, string> = { recommended: 'Più apprezzati', distance: 'Più vicini', recent: 'Novità' };
