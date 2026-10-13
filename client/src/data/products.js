export const categories = [
  { id: 'all', name: 'All Machines' },
  { id: 'floor-stand', name: 'Floor Standing' },
  { id: 'wall-mounted', name: 'Wall Mounted' },
  { id: 'elevator', name: 'Elevator Vending' },
];

export const productGroups = [
  { title: 'Floor Standing', description: 'Large-capacity machines with prominent displays and flexible dispensing lanes.', categories: ['floor-stand'] },
  { title: 'Wall Mounted', description: 'Compact touchscreen vending for locations where floor space is limited.', categories: ['wall-mounted'] },
  { title: 'Elevator Vending', description: 'Controlled elevator delivery for snacks, meals and delicate packaged products.', categories: ['elevator'] },
];

export const categoryNames = Object.fromEntries(categories.filter(({ id }) => id !== 'all').map(({ id, name }) => [id, name]));
