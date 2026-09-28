export const categories = [
  { id: 'all', name: 'All Machines' },
  { id: 'snack-drink', name: 'Snack & Drink' },
  { id: 'fresh-food', name: 'Fresh Food' },
  { id: 'specialty', name: 'Specialty Retail' },
];

export const productGroups = [
  { title: 'Snack & Drink', description: 'Reliable ambient and refrigerated machines for offices, campuses and transport hubs.', categories: ['snack-drink'] },
  { title: 'Fresh Food', description: 'Temperature-controlled smart retail for meals, produce and premium grab-and-go.', categories: ['fresh-food'] },
  { title: 'Specialty Retail', description: 'Flexible lockers and vending platforms for PPE, electronics, beauty and convenience goods.', categories: ['specialty'] },
];

export const categoryNames = Object.fromEntries(categories.filter(({ id }) => id !== 'all').map(({ id, name }) => [id, name]));
