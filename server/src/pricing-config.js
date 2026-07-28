import { db } from './db.js';
import { parseJson } from './utils.js';

export const PLAN_SKUS = Object.freeze(['free', 'credit', 'monthly', 'pro']);

export const DEFAULT_PLAN_BENEFITS = Object.freeze({
  free: Object.freeze({
    credits: 2,
    durationDays: 60,
    revisionsPerReport: 3,
    storageMb: 100,
    features: Object.freeze(['2 credit awal', '3 revisi per laprak', '100 MB penyimpanan']),
  }),
  credit: Object.freeze({
    credits: 1,
    durationDays: 180,
    revisionsPerReport: 5,
    storageMb: 500,
    features: Object.freeze(['Tanpa subscription', '5 revisi per laprak', 'Aktif hingga 180 hari']),
  }),
  monthly: Object.freeze({
    credits: 12,
    durationDays: 30,
    revisionsPerReport: 5,
    storageMb: 1024,
    features: Object.freeze(['12 credit / 30 hari', 'Mode Thinking terbuka', '1 GB penyimpanan']),
  }),
  pro: Object.freeze({
    credits: 20,
    durationDays: 30,
    revisionsPerReport: 15,
    storageMb: 5120,
    features: Object.freeze(['20 credit / 30 hari', 'Mode XtraThink terbuka', '5 GB penyimpanan']),
  }),
});

function configuredInteger(value, fallback, minimum) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum ? parsed : fallback;
}

export function planBenefits(sku) {
  const resolvedSku = sku === 'single' ? 'credit' : sku;
  const defaults = DEFAULT_PLAN_BENEFITS[resolvedSku] || DEFAULT_PLAN_BENEFITS.free;
  const override = db.prepare(`
    SELECT credits, duration_days, revisions_per_report, storage_mb, features_json
    FROM pricing_overrides
    WHERE sku = ?
  `).get(resolvedSku);
  const storedFeatures = override?.features_json === null || override?.features_json === undefined
    ? defaults.features
    : parseJson(override.features_json, defaults.features);
  const features = Array.isArray(storedFeatures)
    ? storedFeatures.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 10)
    : [...defaults.features];

  return {
    credits: configuredInteger(override?.credits, defaults.credits, 0),
    durationDays: configuredInteger(override?.duration_days, defaults.durationDays, 1),
    revisionsPerReport: configuredInteger(override?.revisions_per_report, defaults.revisionsPerReport, 0),
    storageMb: configuredInteger(override?.storage_mb, defaults.storageMb, 1),
    features,
  };
}

export function allPlanBenefits() {
  return Object.fromEntries(PLAN_SKUS.map((sku) => [sku, planBenefits(sku)]));
}
