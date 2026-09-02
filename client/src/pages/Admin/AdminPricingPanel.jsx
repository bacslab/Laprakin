import { useCallback, useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { api } from '../../api';
import { pricingFallback, pricingFeatures } from '../../data/pricing';
import { Button } from '../../components/Button';

export default function AdminPricingPanel({ setNotice }) {
  const [products, setProducts] = useState([]);
  const [busy, setBusy] = useState(false);
  const loadPricing = useCallback(() => api('/admin/pricing').then((data) => {
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
      createProduct('free', 'Free', data.free, pricingFallback.free, 0),
      createProduct('credit', 'Satuan', data.single, pricingFallback.single, data.single?.originalPrice || data.single?.unitPrice || 3900),
      createProduct('monthly', 'Pro', data.monthly, pricingFallback.monthly, data.monthly?.originalPrice || data.monthly?.price || 29900),
      createProduct('pro', 'Max', data.pro, pricingFallback.pro, data.pro?.originalPrice || data.pro?.price || 45900),
    ]);
  }).catch((error) => setNotice(error.message)), [setNotice]);
  useEffect(() => { loadPricing(); }, [loadPricing]);
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
      await loadPricing(); setNotice('Benefit, harga, dan diskon berhasil diperbarui.');
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };
  return <section className="admin-content">
    <div className="admin-panel admin-wide">
      <div className="admin-panel-head"><h2>Plan dan benefit</h2><small>Nilai ini dipakai langsung oleh pricing, checkout, credit, revisi, dan penyimpanan.</small></div>
      <div className="admin-pricing-grid">
        {products.map((product) => <article key={product.sku}>
          <h3>{product.label}</h3>
          <div className="admin-pricing-fields">
             <label>Harga rupiah<input aria-label={`${product.label} harga rupiah`} type="number" min={product.sku === 'free' ? 0 : 1000} max="10000000" disabled={product.sku === 'free'} value={product.unitPriceIdr} onChange={(event) => update(product.sku, { unitPriceIdr: event.target.value })}/></label>
             <label>Jumlah credit<input aria-label={`${product.label} jumlah credit`} type="number" min="1" max="1000" value={product.credits} onChange={(event) => update(product.sku, { credits: event.target.value })}/></label>
             <label>Masa aktif (hari)<input aria-label={`${product.label} masa aktif`} type="number" min="1" max="3650" value={product.durationDays} onChange={(event) => update(product.sku, { durationDays: event.target.value })}/></label>
             <label>Revisi per laprak<input aria-label={`${product.label} revisi per laprak`} type="number" min="0" max="100" value={product.revisionsPerReport} onChange={(event) => update(product.sku, { revisionsPerReport: event.target.value })}/></label>
             <label>Penyimpanan (MB)<input aria-label={`${product.label} penyimpanan megabyte`} type="number" min="1" max="102400" value={product.storageMb} onChange={(event) => update(product.sku, { storageMb: event.target.value })}/></label>
             {product.sku !== 'free' && <label>Diskon persen<input aria-label={`${product.label} diskon persen`} type="number" min="0" max="90" value={product.discountPercent} onChange={(event) => update(product.sku, { discountPercent: event.target.value })}/></label>}
             {product.sku !== 'free' && <label>Diskon berakhir<input aria-label={`${product.label} diskon berakhir`} type="datetime-local" value={product.discountExpiresAt ? product.discountExpiresAt.slice(0,16) : ''} onChange={(event) => update(product.sku, { discountExpiresAt: event.target.value })}/></label>}
          </div>
           <label>Daftar fitur <span>Satu fitur per baris</span><textarea aria-label={`${product.label} daftar fitur`} rows="4" maxLength="1200" value={product.featuresText} onChange={(event) => update(product.sku, { featuresText: event.target.value })}/></label>
        </article>)}
      </div>
      <Button onClick={save} disabled={busy || products.length !== 4}><Save size={14}/>Simpan plan</Button>
    </div>
  </section>;
}
