export const pricingFallback = {
  free: { credits: 2, durationDays: 60, revisionsPerReport: 3, storageMb: 100, features: ['2 credit awal', '3 revisi per laprak', '100 MB penyimpanan'] },
  single: { unitPrice: 3900, minQuantity: 1, maxQuantity: 20, credits: 1, durationDays: 180, revisionsPerReport: 5, storageMb: 500, features: ['Tanpa subscription', '5 revisi per laprak', 'Aktif hingga 180 hari'] },
  monthly: { price: 29900, credits: 12, durationDays: 30, revisionsPerReport: 5, storageMb: 1024, storageGb: 1, features: ['12 credit / 30 hari', 'Mode Thinking terbuka', '1 GB penyimpanan'] },
  pro: { price: 45900, credits: 20, durationDays: 30, revisionsPerReport: 15, storageMb: 5120, storageGb: 5, features: ['20 credit / 30 hari', 'Mode XtraThink terbuka', '5 GB penyimpanan'] },
};

export function pricingFeatures(plan, fallback) {
  return Array.isArray(plan?.features) ? plan.features : fallback;
}
