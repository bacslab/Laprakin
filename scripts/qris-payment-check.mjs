import assert from 'node:assert/strict';
import { buildOrderQuote, midtransOrigins } from '../server/src/payments.js';

// This is deliberately pure pricing verification: the browser is allowed to
// send SKU + quantity only; arbitrary price fields must never affect totals.
const cart = buildOrderQuote({
  items: [
    { sku: 'monthly', quantity: 1, price: 1 },
    { sku: 'credit', quantity: 3, unitPriceIdr: 1 },
  ],
});
assert.equal(cart.totalIdr, 29900 + (3 * 3900));
assert.equal(cart.grossAmount, 41600);
assert.equal(cart.items.length, 2);
assert.equal(cart.items.find((item) => item.sku === 'credit').unitPriceIdr, 3900);
assert.throws(() => buildOrderQuote({ items: [{ sku: 'monthly', quantity: 1 }, { sku: 'pro', quantity: 1 }] }), /Satu checkout/);
assert.throws(() => buildOrderQuote({ items: [{ sku: 'credit', quantity: 21 }] }), /Jumlah/);
assert.deepEqual(midtransOrigins('production'), {
  snap: 'https://app.midtrans.com',
  api: 'https://api.midtrans.com',
});
assert.deepEqual(midtransOrigins('sandbox'), {
  snap: 'https://app.sandbox.midtrans.com',
  api: 'https://api.sandbox.midtrans.com',
});
console.log('QRIS payment pricing check passed: server total is authoritative and cart validation is active.');
