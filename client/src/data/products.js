export const categories = [
  { id: 'all', name: 'All Ingredients' },
  { id: 'active-ingredients', name: 'Active Ingredients' },
  { id: 'botanical-extracts', name: 'Botanical Extracts' },
  { id: 'functional-materials', name: 'Functional Materials' },
];

export const productGroups = [
  { title: 'Performance Actives', description: 'Documented cosmetic actives selected for hydration, barrier, tone and comfort-led formulation briefs.', categories: ['active-ingredients'] },
  { title: 'Botanical Extracts', description: 'Standardized plant-derived materials supplied with clear INCI, format and handling guidance.', categories: ['botanical-extracts'] },
  { title: 'Functional Materials', description: 'Emollients, emulsifiers and sensory modifiers that shape stability, texture and finish.', categories: ['functional-materials'] },
];

export const categoryNames = Object.fromEntries(categories.filter(({ id }) => id !== 'all').map(({ id, name }) => [id, name]));
