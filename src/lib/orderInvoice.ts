/** Same purchase confirmation code displayed by the mobile invoice. */
export function confirmationCodeFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) & 0xfffff;
  }
  return String(100000 + (hash % 900000));
}
