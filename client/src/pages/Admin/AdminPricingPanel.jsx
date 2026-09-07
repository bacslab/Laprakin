import { useCallback, useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { api } from '../../api';
import { pricingFallback, pricingFeatures } from '../../data/pricing';
import { Button } from '../../components/Button';
import { useI18n } from '../../i18n/context';

export default function AdminPricingPanel({ setNotice, initialPricing, reloadPricing = null }) {
  const { t } = useI18n();
  const [products, setProducts] = useState([]);
  const [busy, setBusy] = useState(false);
  const applyPricing = useCallback((data) => {
    const createProduct = (sku, label, plan, fallback, price) => ({
      sku,
      label,
      unitPriceIdr: price,
      discountPercent: plan?.discountPercent || 0,
      discountExpiresAt: plan?.discountExpiresAt || '',
      credits: plan?.credits ?? fallback.credits,
      durationDays: plan?.durationDays ?? fallback.durationDays,
      revisionsPerReport: plan?.revisionsPerReport ?? fallback.revisionsPerReport,
      storageMb: plan?.storageMb ?? fallback.storageMb,
      featuresText: pricingFeatures(plan, fallback.features).join('\n'),
    });
    setProducts([
      createProduct('free', t('admin.console.pricing.free'), data.free, pricingFallback.free, 0),
      createProduct('credit', t('admin.console.pricing.single'), data.single, pricingFallback.single, data.single?.originalPrice || data.single?.unitPrice || 3900),
      createProduct('monthly', t('admin.console.pricing.pro'), data.monthly, pricingFallback.monthly, data.monthly?.originalPrice || data.monthly?.price || 29900),
      createProduct('pro', t('admin.console.pricing.max'), data.pro, pricingFallback.pro, data.pro?.originalPrice || data.pro?.price || 45900),
    ]);
  }, [t]);
  const loadPricing = useCallback(() => (reloadPricing ? reloadPricing() : api('/admin/pricing')).then((data) => { if (data) applyPricing(data); }).catch((error) => setNotice(error.message)), [applyPricing, reloadPricing, setNotice]);
  useEffect(() => { applyPricing(initialPricing); }, [applyPricing, initialPricing]);
  const update = (sku, patch) => setProducts((items) => items.map((item) => item.sku === sku ? { ...item, ...patch } : item));
  const save = async () => {
    setBusy(true);
    try {
      await api('/admin/pricing', {
        method: 'PUT',
        body: {
          products: products.map((product) => ({
            sku: product.sku,
            unitPriceIdr: Number(product.unitPriceIdr),
            discountPercent: product.sku === 'free' ? 0 : Number(product.discountPercent),
            discountExpiresAt: product.sku === 'free' ? '' : product.discountExpiresAt,
            credits: Number(product.credits),
            durationDays: Number(product.durationDays),
            revisionsPerReport: Number(product.revisionsPerReport),
            storageMb: Number(product.storageMb),
            features: product.featuresText.split('\n').map((item) => item.trim()).filter(Boolean),
          })),
        },
      });
      await loadPricing(); setNotice(t('admin.console.pricing.saved'));
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };
  return <section className="admin-content admin-pricing-page">
    <div className="admin-panel admin-wide">
      <div className="admin-panel-head"><h2>{t('admin.console.pricing.planAndBenefits')}</h2><small>{t('admin.console.pricing.description')}</small></div>
      <div className="admin-pricing-grid">
        {products.map((product) => <article key={product.sku}>
          <h3>{product.label}</h3>
          <div className="admin-pricing-fields">
             <label>{t('admin.console.pricing.price')}<input aria-label={`${product.label} ${t('admin.console.pricing.price')}`} type="number" min={product.sku === 'free' ? 0 : 1000} max="10000000" disabled={product.sku === 'free'} value={product.unitPriceIdr} onChange={(event) => update(product.sku, { unitPriceIdr: event.target.value })}/></label>
             <label>{t('admin.console.pricing.credits')}<input aria-label={`${product.label} ${t('admin.console.pricing.credits')}`} type="number" min="1" max="1000" value={product.credits} onChange={(event) => update(product.sku, { credits: event.target.value })}/></label>
             <label>{t('admin.console.pricing.duration')}<input aria-label={`${product.label} ${t('admin.console.pricing.duration')}`} type="number" min="1" max="3650" value={product.durationDays} onChange={(event) => update(product.sku, { durationDays: event.target.value })}/></label>
             <label>{t('admin.console.pricing.revisions')}<input aria-label={`${product.label} ${t('admin.console.pricing.revisions')}`} type="number" min="0" max="100" value={product.revisionsPerReport} onChange={(event) => update(product.sku, { revisionsPerReport: event.target.value })}/></label>
             <label>{t('admin.console.pricing.storage')}<input aria-label={`${product.label} ${t('admin.console.pricing.storage')}`} type="number" min="1" max="102400" value={product.storageMb} onChange={(event) => update(product.sku, { storageMb: event.target.value })}/></label>
             {product.sku !== 'free' && <label>{t('admin.console.pricing.discount')}<input aria-label={`${product.label} ${t('admin.console.pricing.discount')}`} type="number" min="0" max="90" value={product.discountPercent} onChange={(event) => update(product.sku, { discountPercent: event.target.value })}/></label>}
             {product.sku !== 'free' && <label>{t('admin.console.pricing.discountExpiry')}<input aria-label={`${product.label} ${t('admin.console.pricing.discountExpiry')}`} type="datetime-local" value={product.discountExpiresAt ? product.discountExpiresAt.slice(0,16) : ''} onChange={(event) => update(product.sku, { discountExpiresAt: event.target.value })}/></label>}
          </div>
           <label>{t('admin.console.pricing.features')} <span>{t('admin.console.pricing.onePerLine')}</span><textarea aria-label={t('admin.console.pricing.featuresAria', { label: product.label })} rows="4" maxLength="1200" value={product.featuresText} onChange={(event) => update(product.sku, { featuresText: event.target.value })}/></label>
        </article>)}
      </div>
      <Button onClick={save} disabled={busy || products.length !== 4}><Save size={14}/>{t('admin.console.pricing.save')}</Button>
    </div>
  </section>;
}
