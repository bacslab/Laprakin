import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.PAYMENTS_MODE = 'midtrans';
process.env.MIDTRANS_SERVER_KEY = 'Mid-server-notification-contract';
process.env.MIDTRANS_CLIENT_KEY = 'Mid-client-notification-contract';

const [{ buildOrderQuote, midtransOrigins, processMidtransWebhook }, { db }] = await Promise.all([
  import('../server/src/payments.js'),
  import('../server/src/db.js'),
]);

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
const testOrderId = `midtrans-dashboard-test-${Date.now()}`;
const testStatusCode = '200';
const testGrossAmount = '10000.00';
const testSignature = crypto.createHash('sha512')
  .update(`${testOrderId}${testStatusCode}${testGrossAmount}${process.env.MIDTRANS_SERVER_KEY}`)
  .digest('hex');
const acknowledgedTest = await processMidtransWebhook({
  order_id: testOrderId,
  status_code: testStatusCode,
  gross_amount: testGrossAmount,
  signature_key: testSignature,
  transaction_status: 'settlement',
  payment_type: 'qris',
});
assert.equal(acknowledgedTest.acknowledged, true);
assert.equal(acknowledgedTest.ignored, true);
await assert.rejects(
  processMidtransWebhook({ order_id: testOrderId }),
  (error) => error.code === 'INVALID_PAYMENT_SIGNATURE' && error.status === 401,
);
db.prepare(`DELETE FROM audit_logs WHERE target_type = 'payment_order' AND target_id = ?`).run(testOrderId);
console.log('QRIS payment pricing check passed: server total is authoritative and cart validation is active.');
