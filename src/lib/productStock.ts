import type { ProductRow } from '../types/database';

export function productIsAvailable(product: Pick<ProductRow, 'available' | 'quantity' | 'extra_units'>): boolean {
  return product.available && (Number(product.quantity) > 0 ||
    product.extra_units?.some(unit => Number(unit.quantity) > 0) === true);
}
