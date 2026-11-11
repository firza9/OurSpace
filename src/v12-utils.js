export function localDate(value = new Date()) {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export { isQuietHours } from '../supabase/functions/_shared/quiet-hours.js';

export function monthlySpending(expenses, receipts, month) {
  const linked = new Set(expenses.map(x => x.receipt_id).filter(Boolean));
  return expenses.filter(x => x.spent_on?.startsWith(month)).reduce((n, x) => n + Number(x.amount || 0), 0)
    + receipts.filter(x => x.purchased_on?.startsWith(month) && !linked.has(x.id)).reduce((n, x) => n + Number(x.total || 0), 0);
}

export function inventoryStatus(item, today = localDate()) {
  if (item.expiry_date && item.expiry_date < today) return 'Expired';
  const soon = new Date(`${today}T12:00:00`); soon.setDate(soon.getDate() + 3);
  if (item.expiry_date && item.expiry_date <= localDate(soon)) return 'Use soon';
  if (Number(item.quantity) <= Number(item.low_stock_threshold)) return 'Low stock';
  return 'In stock';
}

// Exact normalized matches only: guessing ingredient quantities or names can hide needed food.
export function missingIngredients(ingredients, grocery, pantry = []) {
  const normalize = value => String(value).trim().toLowerCase().replace(/\s+/g, ' ');
  const existing = new Set([
    ...grocery.filter(x => !x.done).map(x => normalize(x.name)),
    ...pantry.filter(x => Number(x.quantity) > 0 && inventoryStatus(x) !== 'Expired').map(x => normalize(x.name)),
  ]);
  return ingredients.map(x => String(x).trim()).filter(x => {
    const name = normalize(x);
    if (!name || existing.has(name)) return false;
    existing.add(name); return true;
  });
}
