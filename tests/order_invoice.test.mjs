import assert from 'node:assert/strict';
import { test } from 'node:test';
import { confirmationCodeFor } from '../src/lib/orderInvoice.ts';

test('invoice confirmation codes match the mobile purchase-code fixtures', () => {
  assert.equal(confirmationCodeFor('a'), '100097');
  assert.equal(confirmationCodeFor('abc'), '196354');
  assert.equal(confirmationCodeFor('😀'), '824323');
});

test('a UUID invoice id always displays a six-digit purchase code', () => {
  assert.match(confirmationCodeFor('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), /^[1-9]\d{5}$/);
});
