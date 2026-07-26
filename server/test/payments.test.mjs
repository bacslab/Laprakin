// Kontrol keamanan paling penting di alur pembayaran: harga tidak pernah
// dipercaya dari browser. Browser hanya mengirim SKU dan jumlah; seluruh harga,
// batas, dan total dihitung ulang di server oleh buildOrderQuote.
//
// payments.js mengimpor db.js yang menjalankan migrasi saat import, jadi data
// directory diarahkan ke folder sementara sebelum modul dimuat.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'laprakin-test-'));
process.env.LAPRAKIN_DATA_DIR = dataDir;
process.env.LAPRAKIN_UPLOAD_DIR = path.join(dataDir, 'uploads');
process.env.LAPRAKIN_PUBLIC_MEDIA_DIR = path.join(dataDir, 'public-media');

const { PRICING, buildOrderQuote, midtransOrigins } = await import('../src/payments.js');

process.on('exit', () => {
  try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch { /* biarkan OS yang membersihkan */ }
});

test('katalog harga sesuai yang dipublikasikan ke pengguna', () => {
  assert.equal(PRICING.singleCreditIdr, 3900);
  assert.equal(PRICING.monthlyIdr, 29900);
  assert.equal(PRICING.monthlyCredits, 12);
  assert.equal(PRICING.proIdr, 45900);
  assert.equal(PRICING.proCredits, 20);
  assert.equal(PRICING.freeCredits, 2);
});

test('midtransOrigins memisahkan production dari sandbox', () => {
  assert.deepEqual(midtransOrigins('production'), {
    snap: 'https://app.midtrans.com',
    api: 'https://api.midtrans.com',
  });
  assert.deepEqual(midtransOrigins('sandbox'), {
    snap: 'https://app.sandbox.midtrans.com',
    api: 'https://api.sandbox.midtrans.com',
  });
  // Nilai tak dikenal tidak boleh diperlakukan sebagai production.
  assert.equal(midtransOrigins('staging').api, 'https://api.sandbox.midtrans.com');
});

test('buildOrderQuote menghitung credit satuan dari katalog server', () => {
  const quote = buildOrderQuote({ items: [{ sku: 'credit', quantity: 5 }] });
  assert.equal(quote.subtotalIdr, 3900 * 5);
  assert.equal(quote.grossAmount, 3900 * 5);
  assert.equal(quote.totalCredits, 5);
  assert.equal(quote.primaryPlanKey, 'single');
  assert.equal(quote.currency, 'IDR');
});

test('buildOrderQuote mengabaikan harga yang dikirim browser', () => {
  // Inti kontrolnya: klien jahat mengirim harga satu rupiah, server tetap
  // memakai harga katalog.
  const quote = buildOrderQuote({
    items: [{ sku: 'pro', quantity: 1, unitPriceIdr: 1, subtotalIdr: 1, price: 1 }],
  });
  assert.equal(quote.subtotalIdr, PRICING.proIdr);
  assert.equal(quote.items[0].unitPriceIdr, PRICING.proIdr);
  assert.equal(quote.totalCredits, PRICING.proCredits);
  assert.equal(quote.items[0].durationDays, 30);
});

test('buildOrderQuote menolak SKU di luar katalog', () => {
  assert.throws(
    () => buildOrderQuote({ items: [{ sku: 'gratis-selamanya', quantity: 1 }] }),
    (error) => error.code === 'INVALID_PRODUCT',
  );
});

test('buildOrderQuote membatasi jumlah per produk', () => {
  assert.throws(
    () => buildOrderQuote({ items: [{ sku: 'credit', quantity: 21 }] }),
    (error) => error.code === 'INVALID_QUANTITY',
  );
  assert.throws(
    () => buildOrderQuote({ items: [{ sku: 'monthly', quantity: 2 }] }),
    (error) => error.code === 'INVALID_QUANTITY',
  );
});

test('buildOrderQuote menggabungkan SKU kembar sebelum memvalidasi batas', () => {
  // Tanpa penggabungan, dua baris credit bisa dipakai melewati batas 20.
  const quote = buildOrderQuote({ items: [{ sku: 'credit', quantity: 8 }, { sku: 'credit', quantity: 7 }] });
  assert.equal(quote.items.length, 1);
  assert.equal(quote.items[0].quantity, 15);
  assert.equal(quote.subtotalIdr, 3900 * 15);

  assert.throws(
    () => buildOrderQuote({ items: [{ sku: 'credit', quantity: 12 }, { sku: 'credit', quantity: 12 }] }),
    (error) => error.code === 'INVALID_QUANTITY',
  );
});

test('buildOrderQuote menolak lebih dari satu subscription per checkout', () => {
  assert.throws(
    () => buildOrderQuote({ items: [{ sku: 'monthly', quantity: 1 }, { sku: 'pro', quantity: 1 }] }),
    (error) => error.code === 'MULTIPLE_SUBSCRIPTIONS',
  );
});

test('buildOrderQuote menolak jumlah pecahan dan negatif', () => {
  for (const quantity of [1.5, -3]) {
    assert.throws(
      () => buildOrderQuote({ items: [{ sku: 'credit', quantity }] }),
      (error) => error.code === 'INVALID_QUANTITY',
      `jumlah ${quantity} seharusnya ditolak`,
    );
  }
});

test('buildOrderQuote menggabungkan subscription dengan credit tambahan', () => {
  const quote = buildOrderQuote({ items: [{ sku: 'monthly', quantity: 1 }, { sku: 'credit', quantity: 3 }] });
  assert.equal(quote.subtotalIdr, PRICING.monthlyIdr + PRICING.singleCreditIdr * 3);
  assert.equal(quote.totalCredits, PRICING.monthlyCredits + 3);
  assert.equal(quote.primaryPlanKey, 'monthly');
});

test('buildOrderQuote tetap mendukung bentuk plan lama dari billing UI', () => {
  const single = buildOrderQuote({ plan: 'single', quantity: 4 });
  assert.equal(single.items[0].sku, 'credit');
  assert.equal(single.subtotalIdr, 3900 * 4);

  // Subscription selalu dipaksa satu unit walau quantity dikirim lebih besar.
  const pro = buildOrderQuote({ plan: 'pro', quantity: 9 });
  assert.equal(pro.items[0].sku, 'pro');
  assert.equal(pro.items[0].quantity, 1);
  assert.equal(pro.subtotalIdr, PRICING.proIdr);
});
