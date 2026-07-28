import crypto from 'node:crypto';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { config } from './config.js';
import { audit, db } from './db.js';
import { allPlanBenefits, DEFAULT_PLAN_BENEFITS } from './pricing-config.js';
import { HttpError, now, parseJson } from './utils.js';
import {
  activeSubscription,
  grantCredit,
  notifyUser,
  processReferralSubscriptionReward,
} from './services.js';

/**
 * QRIS-only Midtrans payment module.
 *
 * The browser sends only SKU + quantity. The authoritative catalogue, amount,
 * order snapshot, Midtrans payload and fulfilment all stay on the server.
 */
export const PRICING = Object.freeze({
  singleCreditIdr: 3900,
  monthlyIdr: 29900,
  monthlyCredits: 12,
  proIdr: 45900,
  proCredits: 20,
  freeCredits: 2,
  revisions: { free: 3, single: 5, monthly: 5, pro: 15 },
});

const DEFAULT_PRODUCT_CATALOGUE = Object.freeze({
  credit: {
    sku: 'credit', kind: 'credit', planKey: 'single', label: 'Credit Laprakin',
    unitPrice: PRICING.singleCreditIdr, maxQuantity: 20, creditPerUnit: DEFAULT_PLAN_BENEFITS.credit.credits,
    durationDays: DEFAULT_PLAN_BENEFITS.credit.durationDays,
  },
  monthly: {
    sku: 'monthly', kind: 'subscription', planKey: 'monthly', label: 'Plan Pro',
    unitPrice: PRICING.monthlyIdr, maxQuantity: 1, creditPerUnit: DEFAULT_PLAN_BENEFITS.monthly.credits,
    durationDays: DEFAULT_PLAN_BENEFITS.monthly.durationDays,
  },
  pro: {
    sku: 'pro', kind: 'subscription', planKey: 'pro', label: 'Plan Max',
    unitPrice: PRICING.proIdr, maxQuantity: 1, creditPerUnit: DEFAULT_PLAN_BENEFITS.pro.credits,
    durationDays: DEFAULT_PLAN_BENEFITS.pro.durationDays,
  },
});

function productCatalogue() {
  const benefits = allPlanBenefits();
  const overrides = new Map(db.prepare(`
    SELECT sku, unit_price_idr, discount_percent, discount_expires_at
    FROM pricing_overrides
  `).all().map((row) => [row.sku, row]));
  return Object.fromEntries(Object.entries(DEFAULT_PRODUCT_CATALOGUE).map(([sku, product]) => {
    const override = overrides.get(sku);
    const basePrice = Number(override?.unit_price_idr || product.unitPrice);
    const discountActive = Number(override?.discount_percent || 0) > 0
      && (!override.discount_expires_at || override.discount_expires_at > now());
    const discountPercent = discountActive ? Number(override.discount_percent) : 0;
    const effectivePrice = Math.max(1, Math.round(basePrice * (100 - discountPercent) / 100));
    return [sku, {
      ...product,
      creditPerUnit: benefits[sku].credits,
      durationDays: benefits[sku].durationDays,
      revisionsPerReport: benefits[sku].revisionsPerReport,
      storageMb: benefits[sku].storageMb,
      features: benefits[sku].features,
      unitPrice: effectivePrice,
      originalUnitPrice: basePrice,
      discountPercent,
      discountExpiresAt: discountActive ? override.discount_expires_at || null : null,
    }];
  }));
}

const checkoutItemSchema = z.object({
  sku: z.enum(['credit', 'monthly', 'pro']),
  quantity: z.coerce.number().int().min(1).max(20).optional().default(1),
});

// `plan`/`quantity` remain supported for the old billing UI, while new clients
// should send `{ items: [{ sku, quantity }] }`.
export const checkoutRequestSchema = z.object({
  items: z.array(checkoutItemSchema).min(1).max(3).optional(),
  plan: z.enum(['single', 'monthly', 'pro']).optional(),
  quantity: z.coerce.number().int().min(1).max(20).optional().default(1),
}).superRefine((value, ctx) => {
  if (!value.items?.length && !value.plan) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Pilih minimal satu produk untuk dibayar.' });
  }
});

const MIDTRANS_QRIS_CHANNEL = 'other_qris';
const PAYMENT_ORDER_TTL_MINUTES = 15;
const TERMINAL_STATUSES = new Set(['paid', 'failed', 'expired', 'canceled', 'refunded']);

export function midtransOrigins(environment = config.midtransEnvironment) {
  const production = environment === 'production';
  return {
    snap: production ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com',
    api: production ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com',
  };
}

function midtransAuthHeader() {
  return `Basic ${Buffer.from(`${config.midtransServerKey}:`).toString('base64')}`;
}

function midtransEnabled() {
  return config.paymentsMode === 'midtrans' && Boolean(config.midtransServerKey && config.midtransClientKey);
}

function formatExpiry(minutes = PAYMENT_ORDER_TTL_MINUTES) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function stableCartKey(userId, items) {
  const canonical = items
    .map((item) => `${item.sku}:${item.quantity}`)
    .sort()
    .join('|');
  return crypto.createHash('sha256').update(`${userId}:${canonical}`).digest('hex');
}

function paymentOrderId() {
  return `LPK-${Date.now()}-${nanoid(8)}`;
}

function timingSafeEqualText(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function currency(value) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function legacyItems(plan, quantity) {
  const sku = plan === 'single' ? 'credit' : plan === 'pro' ? 'pro' : 'monthly';
  return [{ sku, quantity: sku === 'credit' ? quantity : 1 }];
}

/** Server-side catalogue lookup, normalization, and snapshot creation. */
export function buildOrderQuote(input) {
  const rawItems = input.items?.length ? input.items : legacyItems(input.plan, input.quantity);
  const catalogue = productCatalogue();
  const merged = new Map();
  for (const item of rawItems) {
    const sku = item.sku;
    const quantity = Number(item.quantity || 1);
    merged.set(sku, (merged.get(sku) || 0) + quantity);
  }

  const items = [];
  let subscriptionCount = 0;
  for (const [sku, quantity] of merged.entries()) {
    const product = catalogue[sku];
    if (!product) throw new HttpError(400, 'Produk tidak tersedia.', 'INVALID_PRODUCT');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > product.maxQuantity) {
      throw new HttpError(400, `Jumlah ${product.label} tidak valid.`, 'INVALID_QUANTITY');
    }
    if (product.kind === 'subscription') subscriptionCount += 1;
    items.push({
      sku: product.sku,
      kind: product.kind,
      planKey: product.planKey,
      label: product.label,
      quantity,
      unitPriceIdr: product.unitPrice,
      originalUnitPriceIdr: product.originalUnitPrice,
      discountPercent: product.discountPercent,
      subtotalIdr: product.unitPrice * quantity,
      creditPerUnit: product.creditPerUnit,
      durationDays: product.durationDays,
    });
  }

  if (subscriptionCount > 1) {
    throw new HttpError(400, 'Satu checkout hanya dapat memuat satu subscription. Tambahkan credit bila diperlukan.', 'MULTIPLE_SUBSCRIPTIONS');
  }

  const subtotalIdr = items.reduce((total, item) => total + (item.originalUnitPriceIdr * item.quantity), 0);
  const totalIdr = items.reduce((total, item) => total + item.subtotalIdr, 0);
  const discountIdr = subtotalIdr - totalIdr;
  if (!Number.isSafeInteger(totalIdr) || totalIdr < 1 || totalIdr > 10_000_000) {
    throw new HttpError(400, 'Total checkout berada di luar batas QRIS.', 'INVALID_GROSS_AMOUNT');
  }
  const subscription = items.find((item) => item.kind === 'subscription') || null;
  const primaryPlanKey = subscription?.planKey || 'single';
  const totalCredits = items.reduce((total, item) => total + (item.creditPerUnit * item.quantity), 0);

  return {
    currency: 'IDR',
    items,
    subtotalIdr,
    discountIdr,
    totalIdr,
    grossAmount: totalIdr,
    primaryPlanKey,
    totalCredits,
    displayTotal: currency(totalIdr),
  };
}

export function pricingPayload() {
  const catalogue = productCatalogue();
  const benefits = allPlanBenefits();
  return {
    currency: 'IDR',
    qrisOnly: true,
    products: Object.values(catalogue).map((item) => ({
      sku: item.sku,
      label: item.label,
      kind: item.kind,
      unitPriceIdr: item.unitPrice,
      originalUnitPriceIdr: item.originalUnitPrice,
      discountPercent: item.discountPercent,
      discountExpiresAt: item.discountExpiresAt,
      maxQuantity: item.maxQuantity,
      credits: item.creditPerUnit,
      durationDays: item.durationDays,
      revisionsPerReport: item.revisionsPerReport,
      storageMb: item.storageMb,
      features: item.features,
    })),
    free: { label: 'Free', price: 0, originalPrice: 0, discountPercent: 0, discountExpiresAt: null, ...benefits.free },
    single: { unitPrice: catalogue.credit.unitPrice, originalPrice: catalogue.credit.originalUnitPrice, discountPercent: catalogue.credit.discountPercent, discountExpiresAt: catalogue.credit.discountExpiresAt, minQuantity: 1, maxQuantity: catalogue.credit.maxQuantity, label: 'Credit laprak', ...benefits.credit },
    monthly: { label: 'Pro', price: catalogue.monthly.unitPrice, originalPrice: catalogue.monthly.originalUnitPrice, discountPercent: catalogue.monthly.discountPercent, discountExpiresAt: catalogue.monthly.discountExpiresAt, ...benefits.monthly, storageGb: benefits.monthly.storageMb / 1024 },
    pro: { label: 'Max', price: catalogue.pro.unitPrice, originalPrice: catalogue.pro.originalUnitPrice, discountPercent: catalogue.pro.discountPercent, discountExpiresAt: catalogue.pro.discountExpiresAt, ...benefits.pro, storageGb: benefits.pro.storageMb / 1024 },
  };
}

export function publicPaymentConfig() {
  if (!config.isProd && config.paymentsMode === 'manual') {
    return {
      enabled: true,
      mode: 'manual',
      channel: 'qris_sandbox_local',
      message: 'Mode lokal aktif. Tidak ada dana nyata yang diproses.',
    };
  }
  const enabled = midtransEnabled();
  return {
    enabled,
    mode: 'midtrans',
    environment: config.midtransEnvironment,
    channel: MIDTRANS_QRIS_CHANNEL,
    qrisOnly: true,
    merchantDisplayName: 'Laprakin',
    clientKey: enabled ? config.midtransClientKey : '',
    scriptUrl: enabled ? `${midtransOrigins().snap}/snap/snap.js` : '',
    message: enabled
      ? 'Checkout QRIS Dinamis Midtrans aktif. Hanya QRIS yang ditampilkan.'
      : 'Kredensial Midtrans belum dikonfigurasi.',
  };
}

function paymentStatusLabel(status) {
  return {
    created: 'Menyiapkan checkout QRIS',
    pending: 'Menunggu pembayaran QRIS',
    paid: 'Pembayaran berhasil',
    failed: 'Pembayaran ditolak',
    expired: 'Pembayaran kedaluwarsa',
    canceled: 'Pembayaran dibatalkan',
    refunded: 'Dana dikembalikan',
  }[status] || status;
}

export function serializePaymentOrder(row) {
  if (!row) return null;
  const items = parseJson(row.items_json, []);
  return {
    id: row.id,
    status: row.status,
    statusLabel: paymentStatusLabel(row.status),
    amountIdr: Number(row.amount_idr || 0),
    amountLabel: currency(row.amount_idr),
    currency: row.currency || 'IDR',
    planKey: row.plan_key,
    items: Array.isArray(items) ? items.map((item) => ({
      sku: item.sku,
      label: item.label,
      quantity: Number(item.quantity || 1),
      subtotalIdr: Number(item.subtotalIdr || 0),
      kind: item.kind,
    })) : [],
    paymentMethod: row.payment_type || 'QRIS',
    channel: row.payment_channel || MIDTRANS_QRIS_CHANNEL,
    expiresAt: row.expires_at || null,
    paidAt: row.paid_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    canRefresh: !TERMINAL_STATUSES.has(row.status),
    canResume: row.status === 'pending' && Boolean(row.checkout_url) && Boolean(row.snap_token),
  };
}

function validActiveOrder(row) {
  return row && ['created', 'pending'].includes(row.status) && row.expires_at && new Date(row.expires_at).getTime() > Date.now();
}

function reusedCheckoutResponse(order) {
  if (!order.snap_token || !order.checkout_url) {
    throw new HttpError(409, 'Checkout QRIS sedang disiapkan. Tunggu sebentar lalu muat ulang halaman billing.', 'CHECKOUT_IN_PROGRESS');
  }
  return {
    ...publicPaymentConfig(), mode: 'midtrans', orderId: order.id,
    snapToken: order.snap_token, checkoutUrl: order.checkout_url,
    order: serializePaymentOrder(order), reused: true,
  };
}

function latestActiveOrderFor(userId, checkoutKey) {
  return db.prepare(`
    SELECT * FROM payment_orders
    WHERE user_id = ? AND checkout_key = ? AND status IN ('created', 'pending') AND expires_at > ?
    ORDER BY created_at DESC LIMIT 1
  `).get(userId, checkoutKey, now()) || null;
}

function sanitizedMidtransEvent(payload = {}) {
  return {
    order_id: String(payload.order_id || '').slice(0, 96),
    transaction_id: String(payload.transaction_id || '').slice(0, 120),
    transaction_status: String(payload.transaction_status || '').slice(0, 64),
    fraud_status: String(payload.fraud_status || '').slice(0, 64),
    payment_type: String(payload.payment_type || '').slice(0, 64),
    acquirer: String(payload.acquirer || '').slice(0, 64),
    status_code: String(payload.status_code || '').slice(0, 16),
    gross_amount: String(payload.gross_amount || '').slice(0, 32),
    settlement_time: String(payload.settlement_time || '').slice(0, 64),
    transaction_time: String(payload.transaction_time || '').slice(0, 64),
  };
}

function internalPaymentStatus(payload = {}) {
  const status = String(payload.transaction_status || '').toLowerCase();
  const fraud = String(payload.fraud_status || '').toLowerCase();
  if (status === 'settlement' || (status === 'capture' && (!fraud || fraud === 'accept'))) return 'paid';
  if (status === 'pending' || (status === 'capture' && fraud === 'challenge')) return 'pending';
  if (status === 'expire') return 'expired';
  if (status === 'cancel') return 'canceled';
  if (status === 'deny') return 'failed';
  if (status === 'refund' || status === 'partial_refund') return 'refunded';
  return 'created';
}

function isQrisPayment(payload = {}) {
  const type = String(payload.payment_type || '').toLowerCase();
  const acquirer = String(payload.acquirer || '').toLowerCase();
  // `other_qris` is a Snap display channel. Midtrans reports the selected
  // QRIS acquirer as `qris`, `gopay`, or `shopeepay` depending on the route.
  return type === 'qris' || type === 'gopay' || type === 'shopeepay' || acquirer.includes('qris');
}

function eventFingerprint(event, source) {
  return crypto.createHash('sha256').update(JSON.stringify({ source, ...event })).digest('hex');
}

function ensureWebhookEvent(orderId, event, source) {
  const fingerprint = eventFingerprint(event, source);
  const receivedAt = now();
  db.prepare(`
    INSERT OR IGNORE INTO payment_webhook_events
      (id, provider, order_id, transaction_status, payload_json, received_at, source, event_hash)
    VALUES (?, 'midtrans', ?, ?, ?, ?, ?, ?)
  `).run(nanoid(), orderId, event.transaction_status || 'unknown', JSON.stringify(event), receivedAt, source, fingerprint);
}

function snapshotItemsForOrder(order) {
  const items = parseJson(order.items_json, []);
  if (Array.isArray(items) && items.length) return items;
  // Compatibility for payment orders created by versions before the cart snapshot.
  return buildOrderQuote({ plan: order.plan_key, quantity: Number(order.quantity || 1) }).items;
}

function activatePaidOrder(order) {
  const existing = db.prepare('SELECT order_id FROM payment_fulfillments WHERE order_id = ?').get(order.id);
  if (existing) return { fulfilled: false, reason: 'already_fulfilled' };

  const items = snapshotItemsForOrder(order);
  const fulfilledAt = now();
  let subscriptionId = null;
  let subscriptionItem = null;

  db.exec('BEGIN IMMEDIATE');
  try {
    const duplicate = db.prepare('SELECT order_id FROM payment_fulfillments WHERE order_id = ?').get(order.id);
    if (duplicate) {
      db.exec('COMMIT');
      return { fulfilled: false, reason: 'already_fulfilled' };
    }

    for (const item of items) {
      if (item.kind === 'credit') {
        grantCredit({
          userId: order.user_id,
          bucket: 'paid',
          amount: Number(item.creditPerUnit || 1) * Number(item.quantity || 1),
          reason: `Pembelian ${item.label}`,
          referenceType: 'payment_order',
          referenceId: order.id,
          expiresInDays: Math.max(1, Number(item.durationDays || DEFAULT_PLAN_BENEFITS.credit.durationDays)),
        });
        continue;
      }

      if (item.kind === 'subscription') {
        subscriptionItem = item;
        const existingSubscription = activeSubscription(order.user_id);
        if (existingSubscription) db.prepare(`UPDATE subscriptions SET status = 'replaced' WHERE id = ?`).run(existingSubscription.id);
        subscriptionId = nanoid();
        const startsAt = fulfilledAt;
        const duration = Math.max(1, Number(item.durationDays || 30));
        const endsAt = new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString();
        db.prepare(`
          INSERT INTO subscriptions (id, user_id, plan_key, status, provider, provider_reference, starts_at, ends_at, created_at)
          VALUES (?, ?, ?, 'active', 'midtrans_qris', ?, ?, ?, ?)
        `).run(subscriptionId, order.user_id, item.planKey, order.id, startsAt, endsAt, fulfilledAt);
        grantCredit({
          userId: order.user_id,
          bucket: 'paid',
          amount: Number(item.creditPerUnit || 0) * Number(item.quantity || 1),
          reason: `${item.label} · ${Number(item.creditPerUnit || 0) * Number(item.quantity || 1)} credit`,
          referenceType: 'payment_order',
          referenceId: order.id,
          expiresInDays: duration + 5,
        });
      }
    }

    db.prepare(`INSERT INTO payment_fulfillments (order_id, user_id, plan_key, fulfilled_at) VALUES (?, ?, ?, ?)`)
      .run(order.id, order.user_id, order.plan_key, fulfilledAt);
    db.prepare(`
      UPDATE payment_orders
      SET status = 'paid', paid_at = COALESCE(paid_at, ?), fulfilled_at = COALESCE(fulfilled_at, ?), updated_at = ?
      WHERE id = ?
    `).run(fulfilledAt, fulfilledAt, fulfilledAt, order.id);
    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch { /* transaction already closed */ }
    throw error;
  }

  if (subscriptionItem || Number(order.amount_idr || 0) >= 29900) processReferralSubscriptionReward(order.user_id);
  audit(order.user_id, 'payment.fulfilled', 'payment_order', order.id, {
    plan: order.plan_key,
    amountIdr: order.amount_idr,
    subscriptionId,
    channel: MIDTRANS_QRIS_CHANNEL,
  });
  notifyUser(order.user_id, {
    kind: 'billing',
    title: subscriptionItem ? `${subscriptionItem.label} aktif` : 'Credit berhasil ditambahkan',
    body: subscriptionItem
      ? 'Plan dan credit akun telah diaktifkan setelah QRIS terverifikasi.'
      : 'Credit Laprakin siap dipakai.',
    href: '/billing',
  });
  return { fulfilled: true, subscriptionId };
}

function createMidtransPayload(orderId, user, quote) {
  return {
    transaction_details: { order_id: orderId, gross_amount: quote.grossAmount },
    item_details: quote.items.map((item) => ({
      id: item.sku.slice(0, 50),
      price: item.unitPriceIdr,
      quantity: item.quantity,
      name: item.label.slice(0, 50),
      brand: 'Laprakin',
      merchant_name: 'Laprakin',
    })),
    customer_details: {
      first_name: (user.fullName || user.email || 'Pengguna Laprakin').slice(0, 64),
      email: String(user.email || '').slice(0, 254),
    },
    // QRIS only: Midtrans documents `other_qris` as the generic QRIS option
    // that remains visible in Snap when explicitly requested.
    enabled_payments: [MIDTRANS_QRIS_CHANNEL],
    callbacks: {
      finish: `${config.appUrl}/pricing?payment=finished`,
      unfinish: `${config.appUrl}/pricing?payment=canceled`,
      error: `${config.appUrl}/pricing?payment=failed`,
    },
  };
}

async function requestSnapTransaction(orderId, user, quote) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${midtransOrigins().snap}/snap/v1/transactions`, {
      method: 'POST',
      headers: {
        authorization: midtransAuthHeader(),
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(createMidtransPayload(orderId, user, quote)),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.token || !payload.redirect_url) {
      const detail = String(payload.status_message || payload.error_messages?.[0] || 'Gateway menolak membuat checkout QRIS.').slice(0, 280);
      throw new HttpError(502, detail, 'MIDTRANS_CREATE_FAILED');
    }
    return { token: payload.token, redirectUrl: payload.redirect_url };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, 'Gateway pembayaran QRIS tidak dapat dihubungi. Coba lagi beberapa saat.', 'MIDTRANS_UNAVAILABLE');
  } finally {
    clearTimeout(timeout);
  }
}

export async function createQrisCheckout(user, input) {
  const quote = buildOrderQuote(input);
  const checkoutKey = stableCartKey(user.id, quote.items);
  const prior = latestActiveOrderFor(user.id, checkoutKey);
  if (validActiveOrder(prior)) return reusedCheckoutResponse(prior);

  const orderId = paymentOrderId();
  const createdAt = now();
  const expiresAt = formatExpiry();
  try {
    db.prepare(`
      INSERT INTO payment_orders (
        id, user_id, plan_key, quantity, amount_idr, currency, provider, status, expires_at,
        created_at, updated_at, items_json, checkout_key, payment_channel
      ) VALUES (?, ?, ?, ?, ?, 'IDR', 'midtrans', 'created', ?, ?, ?, ?, ?, ?)
    `).run(
      orderId, user.id, quote.primaryPlanKey,
      quote.items.reduce((sum, item) => sum + item.quantity, 0), quote.grossAmount,
      expiresAt, createdAt, createdAt, JSON.stringify(quote.items), checkoutKey, MIDTRANS_QRIS_CHANNEL,
    );
  } catch (error) {
    // The partial unique index in db.js closes the race between two fast clicks.
    // Reuse the first pending checkout rather than issuing a second QRIS code.
    if (String(error?.message || '').includes('idx_payment_orders_active_checkout') || String(error?.message || '').includes('UNIQUE constraint failed')) {
      const competing = latestActiveOrderFor(user.id, checkoutKey);
      if (validActiveOrder(competing)) return reusedCheckoutResponse(competing);
    }
    throw error;
  }

  try {
    const transaction = await requestSnapTransaction(orderId, user, quote);
    db.prepare(`
      UPDATE payment_orders
      SET status = 'pending', snap_token = ?, checkout_url = ?, updated_at = ?
      WHERE id = ?
    `).run(transaction.token, transaction.redirectUrl, now(), orderId);
    const order = db.prepare('SELECT * FROM payment_orders WHERE id = ?').get(orderId);
    audit(user.id, 'payment.qris_checkout_created', 'payment_order', orderId, {
      amountIdr: quote.grossAmount,
      items: quote.items.map((item) => ({ sku: item.sku, quantity: item.quantity })),
      channel: MIDTRANS_QRIS_CHANNEL,
    });
    return {
      ...publicPaymentConfig(), mode: 'midtrans', orderId,
      snapToken: transaction.token, checkoutUrl: transaction.redirectUrl,
      order: serializePaymentOrder(order), reused: false,
    };
  } catch (error) {
    db.prepare(`UPDATE payment_orders SET status = 'failed', failure_reason = ?, updated_at = ? WHERE id = ?`)
      .run(error.code || 'MIDTRANS_CREATE_FAILED', now(), orderId);
    throw error;
  }
}

async function queryMidtransStatus(orderId) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${midtransOrigins().api}/v2/${encodeURIComponent(orderId)}/status`, {
      method: 'GET',
      headers: { authorization: midtransAuthHeader(), accept: 'application/json' },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (String(payload.status_code || '') === '404' && !payload.order_id) {
      throw new HttpError(409, 'Transaksi belum dibuat di Midtrans. Buka checkout QRIS terlebih dahulu.', 'MIDTRANS_STATUS_NOT_READY');
    }
    if (!response.ok || !payload.order_id) {
      throw new HttpError(502, 'Status pembayaran belum dapat diverifikasi ke Midtrans.', 'MIDTRANS_STATUS_UNAVAILABLE');
    }
    return payload;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, 'Status pembayaran belum dapat diverifikasi ke Midtrans.', 'MIDTRANS_STATUS_UNAVAILABLE');
  } finally {
    clearTimeout(timeout);
  }
}

function ensureAmountMatches(order, grossAmount) {
  const notifiedAmount = Number(grossAmount);
  if (!Number.isFinite(notifiedAmount) || Math.round(notifiedAmount) !== Number(order.amount_idr)) {
    audit(order.user_id, 'payment.amount_mismatch', 'payment_order', order.id, {
      notifiedAmount,
      expectedAmount: order.amount_idr,
    });
    throw new HttpError(400, 'Nominal payment notification tidak sesuai.', 'PAYMENT_AMOUNT_MISMATCH');
  }
}

function ensureOrderMatches(order, payload) {
  if (String(payload.order_id || '') !== order.id) {
    throw new HttpError(400, 'Order payment tidak sesuai.', 'PAYMENT_ORDER_MISMATCH');
  }
  ensureAmountMatches(order, payload.gross_amount);
}

function protectedStatusUpdate(order, nextStatus) {
  if (order.status === 'paid' && nextStatus !== 'refunded') return 'paid';
  if (TERMINAL_STATUSES.has(order.status) && order.status !== 'paid') return order.status;
  return nextStatus;
}

function updateOrderFromVerifiedPayload(order, payload, source) {
  ensureOrderMatches(order, payload);
  const receivedAt = now();
  const event = sanitizedMidtransEvent(payload);
  const calculated = internalPaymentStatus(payload);
  const nextStatus = protectedStatusUpdate(order, calculated);

  if (nextStatus === 'paid' && !isQrisPayment(payload)) {
    audit(order.user_id, 'payment.non_qris_rejected', 'payment_order', order.id, {
      paymentType: event.payment_type,
      acquirer: event.acquirer,
    });
    throw new HttpError(400, 'Kanal pembayaran tidak sesuai dengan checkout QRIS.', 'NON_QRIS_PAYMENT');
  }

  ensureWebhookEvent(order.id, event, source);
  db.prepare(`
    UPDATE payment_orders
    SET status = ?,
        midtrans_transaction_id = COALESCE(NULLIF(?, ''), midtrans_transaction_id),
        payment_type = COALESCE(NULLIF(?, ''), payment_type),
        midtrans_status = COALESCE(NULLIF(?, ''), midtrans_status),
        last_webhook_at = CASE WHEN ? = 'webhook' THEN ? ELSE last_webhook_at END,
        last_status_check_at = CASE WHEN ? = 'status_api' THEN ? ELSE last_status_check_at END,
        paid_at = CASE WHEN ? = 'paid' THEN COALESCE(paid_at, ?) ELSE paid_at END,
        updated_at = ?
    WHERE id = ?
  `).run(
    nextStatus, event.transaction_id, event.payment_type, event.transaction_status,
    source, receivedAt, source, receivedAt, nextStatus, receivedAt, receivedAt, order.id,
  );

  const updated = db.prepare('SELECT * FROM payment_orders WHERE id = ?').get(order.id);
  if (nextStatus === 'paid') activatePaidOrder(updated);

  if (nextStatus === 'refunded') {
    audit(order.user_id, 'payment.refund_notified', 'payment_order', order.id, { paymentType: event.payment_type });
    notifyUser(order.user_id, {
      kind: 'billing',
      title: 'Status refund diperbarui',
      body: 'Refund terdeteksi. Tim akan meninjau dampak plan atau credit sesuai kebijakan refund.',
      href: '/billing',
    });
  }
  audit(order.user_id, `payment.${source}_verified`, 'payment_order', order.id, {
    status: nextStatus, paymentType: event.payment_type, channel: MIDTRANS_QRIS_CHANNEL,
  });
  return serializePaymentOrder(db.prepare('SELECT * FROM payment_orders WHERE id = ?').get(order.id));
}

/** Verify Midtrans webhook signature and update order idempotently. */
export async function processMidtransWebhook(payload = {}) {
  if (config.paymentsMode !== 'midtrans' || !config.midtransServerKey) {
    throw new HttpError(503, 'Endpoint pembayaran belum aktif.', 'PAYMENT_NOT_CONFIGURED');
  }
  const orderId = String(payload.order_id || '');
  const statusCode = String(payload.status_code || '');
  const grossAmount = String(payload.gross_amount || '');
  const providedSignature = String(payload.signature_key || '');
  const expectedSignature = crypto.createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${config.midtransServerKey}`)
    .digest('hex');
  if (!orderId || !providedSignature || !timingSafeEqualText(providedSignature, expectedSignature)) {
    throw new HttpError(401, 'Signature payment notification tidak valid.', 'INVALID_PAYMENT_SIGNATURE');
  }
  const order = db.prepare(`SELECT * FROM payment_orders WHERE id = ? AND provider = 'midtrans'`).get(orderId);
  if (!order) {
    audit(null, 'payment.signed_unknown_order_ignored', 'payment_order', orderId, {
      paymentType: String(payload.payment_type || ''),
      transactionStatus: String(payload.transaction_status || ''),
    });
    return { id: orderId, status: 'ignored', acknowledged: true, ignored: true };
  }

  // The signature validates the webhook. A direct status check is additionally
  // performed when enabled so the backend does not act on browser data.
  let verifiedPayload = payload;
  if (config.midtransVerifyStatus) {
    const directStatus = await queryMidtransStatus(orderId);
    ensureOrderMatches(order, directStatus);
    const webhookStatus = String(payload.transaction_status || '').toLowerCase();
    const directTransactionStatus = String(directStatus.transaction_status || '').toLowerCase();
    // Midtrans may deliver a webhook just before the status API reflects the same
    // transition. The direct status response remains authoritative; record the
    // race for audit instead of trusting the browser or rejecting a valid retry.
    if (webhookStatus && directTransactionStatus && webhookStatus !== directTransactionStatus) {
      audit(order.user_id, 'payment.status_verification_race', 'payment_order', order.id, {
        webhookStatus,
        directStatus: directTransactionStatus,
      });
    }
    verifiedPayload = directStatus;
  }
  return updateOrderFromVerifiedPayload(order, verifiedPayload, 'webhook');
}

export function getPaymentOrderForUser(orderId, userId) {
  const order = db.prepare('SELECT * FROM payment_orders WHERE id = ? AND user_id = ?').get(orderId, userId);
  if (!order) throw new HttpError(404, 'Order pembayaran tidak ditemukan.', 'PAYMENT_ORDER_NOT_FOUND');
  return serializePaymentOrder(order);
}

/** Explicit refresh button: server asks Midtrans directly, never trusts browser status. */
export async function refreshPaymentOrderForUser(orderId, userId) {
  if (!midtransEnabled()) throw new HttpError(503, 'Gateway pembayaran belum dikonfigurasi.', 'PAYMENT_NOT_CONFIGURED');
  const order = db.prepare('SELECT * FROM payment_orders WHERE id = ? AND user_id = ? AND provider = ?').get(orderId, userId, 'midtrans');
  if (!order) throw new HttpError(404, 'Order pembayaran tidak ditemukan.', 'PAYMENT_ORDER_NOT_FOUND');
  if (TERMINAL_STATUSES.has(order.status)) return serializePaymentOrder(order);
  try {
    const payload = await queryMidtransStatus(orderId);
    return updateOrderFromVerifiedPayload(order, payload, 'status_api');
  } catch (error) {
    if (error?.code !== 'MIDTRANS_STATUS_NOT_READY') throw error;
    if (order.expires_at && order.expires_at <= now()) {
      const updatedAt = now();
      db.prepare(`UPDATE payment_orders SET status = 'expired', updated_at = ?, last_status_check_at = ? WHERE id = ?`)
        .run(updatedAt, updatedAt, order.id);
      return serializePaymentOrder(db.prepare('SELECT * FROM payment_orders WHERE id = ?').get(order.id));
    }
    db.prepare('UPDATE payment_orders SET last_status_check_at = ?, updated_at = ? WHERE id = ?')
      .run(now(), now(), order.id);
    return serializePaymentOrder(db.prepare('SELECT * FROM payment_orders WHERE id = ?').get(order.id));
  }
}

export function simulateLocalCheckout(user, input) {
  if (config.isProd || config.paymentsMode !== 'manual') {
    throw new HttpError(501, 'Payment provider belum dikonfigurasi untuk environment ini.', 'PAYMENT_NOT_CONFIGURED');
  }
  const quote = buildOrderQuote(input);
  const orderId = paymentOrderId();
  const createdAt = now();
  db.prepare(`
    INSERT INTO payment_orders (
      id, user_id, plan_key, quantity, amount_idr, currency, provider, status, expires_at,
      created_at, updated_at, items_json, checkout_key, payment_channel, paid_at
    ) VALUES (?, ?, ?, ?, ?, 'IDR', 'manual_sandbox', 'paid', ?, ?, ?, ?, ?, 'qris_sandbox_local', ?)
  `).run(
    orderId, user.id, quote.primaryPlanKey,
    quote.items.reduce((sum, item) => sum + item.quantity, 0), quote.grossAmount,
    formatExpiry(), createdAt, createdAt, JSON.stringify(quote.items), stableCartKey(user.id, quote.items), createdAt,
  );
  const order = db.prepare('SELECT * FROM payment_orders WHERE id = ?').get(orderId);
  activatePaidOrder(order);
  audit(user.id, 'payment.sandbox_qris_completed', 'payment_order', orderId, { amountIdr: quote.grossAmount });
  return { mode: 'manual', processed: true, order: serializePaymentOrder(db.prepare('SELECT * FROM payment_orders WHERE id = ?').get(orderId)) };
}
