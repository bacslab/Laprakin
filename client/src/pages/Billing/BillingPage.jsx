import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, CheckCircle2, CircleAlert, CreditCard, LoaderCircle, RefreshCw } from 'lucide-react';
import { useLocation, useNavigate } from '../../router';
import { api } from '../../api';
import { Button } from '../../components/Button';
import { pricingFallback, pricingFeatures } from '../../data/pricing';
import { formatCurrency } from '../../lib/formatters';
import { redirectToMidtransCheckout, validatedMidtransCheckoutUrl } from '../../lib/payment-redirect';
import { useResolvedTheme } from '../../lib/theme';
import { useApp } from '../../state/ui-context';

export default function BillingPage() {
  const { user, setNotice, refreshSession, prefs } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const selectedPlanFromLink = new URLSearchParams(location.search).get('plan') || '';
  const [data, setData] = useState(null);
  const [pricing, setPricing] = useState(pricingFallback);
  const [gateway, setGateway] = useState(null);
  const [subscriptionChoice, setSubscriptionChoice] = useState('none');
  const billingPrefs = prefs;
  const billingTheme = useResolvedTheme(billingPrefs.theme || 'system');
  const [quote, setQuote] = useState(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [activeOrder, setActiveOrder] = useState(null);
  const [checkoutRecoveryUrl, setCheckoutRecoveryUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [billing, nextPricing, paymentConfig] = await Promise.all([
        api('/billing'),
        api('/pricing', { includeCsrf: false }),
        api('/payments/config', { includeCsrf: false }),
      ]);
      setData(billing);
      setPricing(nextPricing || pricingFallback);
      setGateway(paymentConfig);
      const pending = (billing.orders || []).find((order) => ['created', 'pending'].includes(order.status));
      if (pending) setActiveOrder((current) => current?.id === pending.id ? current : { ...pending, canRefresh: true });
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (['monthly', 'pro'].includes(selectedPlanFromLink)) setSubscriptionChoice(selectedPlanFromLink);
  }, [selectedPlanFromLink]);

  // Snap may use a full-page redirect on some browsers. Remember the internal
  // order id locally so the billing page can show an authoritative status after
  // the customer returns; the server still performs the verification.
  useEffect(() => {
    const orderId = window.sessionStorage.getItem('laprakin:active-payment-order');
    if (!orderId) return;
    const returnedFromSnap = new URLSearchParams(window.location.search).get('payment') === 'finished';
    if (returnedFromSnap) getOrder(orderId, true);
    else getOrder(orderId, false);
  }, []);

  const cartItems = useMemo(() => {
    if (subscriptionChoice === 'monthly' || subscriptionChoice === 'pro') return [{ sku: subscriptionChoice, quantity: 1 }];
    return [];
  }, [subscriptionChoice]);
  const cartKey = cartItems.map((item) => `${item.sku}:${item.quantity}`).join('|');

  useEffect(() => {
    let cancelled = false;
    if (!cartItems.length) { setQuote(null); return undefined; }
    setQuoteBusy(true);
    api('/pricing/quote', { method: 'POST', body: { items: cartItems } })
      .then((next) => { if (!cancelled) setQuote(next); })
      .catch((err) => { if (!cancelled) { setQuote(null); setError(err.message); } })
      .finally(() => { if (!cancelled) setQuoteBusy(false); });
    return () => { cancelled = true; };
  }, [cartKey]);

  const plan = data?.currentPlan || { key: 'free', label: 'Gratis', status: 'active', credits: 0, endsAt: null, description: 'Paket awal untuk mencoba Laprakin.' };
  const catalogue = {
    free: { key: 'free', label: 'Gratis', price: 0, description: 'Mulai dan pahami alur kerja Laprakin.', features: pricingFeatures(pricing.free, pricingFallback.free.features) },
    monthly: { key: 'monthly', label: 'Pro', price: pricing.monthly?.price || 29900, description: 'Untuk kebutuhan praktikum yang rutin.', features: pricingFeatures(pricing.monthly, pricingFallback.monthly.features) },
    pro: { key: 'pro', label: 'Max', price: pricing.pro?.price || 45900, description: 'Untuk semester padat dan revisi intensif.', features: pricingFeatures(pricing.pro, pricingFallback.pro.features) },
  };
  const paymentStatusCopy = {
    created: 'Menyiapkan checkout QRIS.',
    pending: 'Menunggu pembayaran. Scan QRIS yang muncul di checkout Midtrans.',
    paid: 'Pembayaran berhasil. Credit atau plan telah diaktifkan oleh server.',
    failed: 'Pembayaran ditolak. Pilih checkout QRIS baru bila ingin mencoba lagi.',
    expired: 'Kode QRIS sudah kedaluwarsa. Buat checkout QRIS baru.',
    canceled: 'Checkout dibatalkan. Belum ada credit atau plan yang ditambahkan.',
    refunded: 'Refund tercatat. Status entitlement ditinjau sesuai kebijakan refund.',
  };

  const updateOrder = async (order, successNotice = '') => {
    setActiveOrder(order);
    if (order?.id && ['created', 'pending'].includes(order.status)) {
      window.sessionStorage.setItem('laprakin:active-payment-order', order.id);
    }
    if (order?.id && ['paid', 'failed', 'expired', 'canceled', 'refunded'].includes(order.status)) {
      window.sessionStorage.removeItem('laprakin:active-payment-order');
    }
    if (order?.status === 'paid') {
      await refreshSession();
      await load();
      setNotice(successNotice || 'Pembayaran QRIS berhasil diverifikasi. Plan atau credit sudah aktif.');
      navigate('/app', { replace: true });
    }
  };

  const getOrder = async (orderId, verifyWithGateway = false) => {
    try {
      setBusy(verifyWithGateway);
      const response = verifyWithGateway
        ? await api(`/payments/orders/${orderId}/refresh`, { method: 'POST', body: {} })
        : await api(`/payments/orders/${orderId}`, { includeCsrf: false });
      await updateOrder(response.order, verifyWithGateway && response.order?.status === 'paid' ? 'Pembayaran QRIS berhasil diverifikasi.' : 'Status pembayaran diperbarui.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!activeOrder?.id || !['created', 'pending'].includes(activeOrder.status)) return undefined;
    const timer = window.setInterval(() => { getOrder(activeOrder.id, false); }, 10_000);
    return () => window.clearInterval(timer);
  }, [activeOrder?.id, activeOrder?.status]);

  const checkout = async () => {
    if (!cartItems.length) { setError('Tambahkan plan atau credit ke keranjang terlebih dahulu.'); return; }
    if (!user?.emailVerified) { setError('Verifikasi email sebelum melakukan pembayaran.'); return; }
    setBusy(true);
    setError('');
    setCheckoutRecoveryUrl('');
    try {
      const payload = await api('/payments/checkout', { method: 'POST', body: { items: cartItems } });
      if (payload.mode === 'manual') {
        await updateOrder(payload.order, 'Checkout QRIS lokal diproses untuk pengujian.');
        return;
      }
      await updateOrder(payload.order);
      window.sessionStorage.setItem('laprakin:active-payment-order', payload.orderId);
      const checkoutUrl = validatedMidtransCheckoutUrl(payload.checkoutUrl);
      if (!checkoutUrl) {
        throw new Error('URL checkout QRIS dari gateway tidak valid.');
      }
      setCheckoutRecoveryUrl(checkoutUrl);
      if (!redirectToMidtransCheckout(checkoutUrl)) {
        throw new Error('Navigasi otomatis diblokir browser. Buka checkout QRIS lewat tombol di bawah.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const selectSubscription = (key) => { setSubscriptionChoice(key === 'free' ? 'none' : key); setError(''); };
  return <div className={`billing-portal pricing-only ${billingTheme === 'dark' ? 'theme-dark' : 'theme-light'}`}>
    <header className="pricing-only-nav"><button className="billing-back" onClick={() => navigate('/app')} aria-label="Kembali ke workspace"><ArrowLeft size={18} /></button></header>
    <main className="pricing-only-main">
      <section className="pricing-only-copy"><h1>Pilih plan yang pas untukmu.</h1><p>Naikkan kapasitas Laprakin saat kamu membutuhkannya.</p></section>
      <section className="pricing-only-grid">
        {['free', 'monthly', 'pro'].map((key) => {
          const item = catalogue[key];
          const current = plan.key === key;
          const isSelected = subscriptionChoice === key;
          const paid = key !== 'free';
          return <article key={key} className={`pricing-only-card ${current ? 'current' : ''} ${isSelected ? 'selected' : ''}`} onClick={() => paid && selectSubscription(key)}>
            <div className="pricing-only-card-top"><span className="pricing-only-marker" aria-hidden="true" /><small>{current ? 'Plan aktif' : key === 'free' ? 'Mulai gratis' : 'Individual'}</small></div>
            <h2>{item.label}</h2><p>{item.description}</p>
            <div className="pricing-only-price"><b>{key === 'free' ? 'Rp0' : formatCurrency(item.price)}</b>{key !== 'free' && <span>/ 30 hari</span>}</div>
            <button type="button" className={current || !paid ? 'muted' : ''} onClick={(event) => { event.stopPropagation(); if (paid) selectSubscription(key); }}>
              {current ? `${item.label} aktif` : !paid ? 'Plan dasar' : isSelected ? 'Dipilih' : `Pilih ${item.label}`}
            </button>
            <ul>{item.features.map((feature) => <li key={feature}><Check size={14}/>{feature}</li>)}</ul>
          </article>;
        })}
      </section>
      {subscriptionChoice !== 'none' && <section className="pricing-only-checkout"><div><small>Checkout QRIS</small><b>{quoteBusy ? 'Menghitung…' : quote?.displayTotal || 'Rp0'}</b><span>{quote?.items?.[0]?.label || 'Plan pilihanmu'} · berlaku 30 hari</span></div><Button onClick={checkout} disabled={busy || quoteBusy || !gateway?.enabled}>{busy ? <LoaderCircle className="spin" size={15}/> : <CreditCard size={15}/>} {gateway?.enabled ? 'Bayar dengan QRIS' : 'Gateway belum aktif'}</Button></section>}
      {activeOrder && <div className={`pricing-only-status ${activeOrder.status || 'pending'}`}><div><b>{activeOrder.statusLabel || paymentStatusCopy[activeOrder.status] || 'Status pembayaran'}</b><p>{paymentStatusCopy[activeOrder.status] || 'Status pembayaran sedang diproses.'}</p></div>{activeOrder.canRefresh !== false && ['created', 'pending'].includes(activeOrder.status) ? <Button variant="secondary" onClick={() => getOrder(activeOrder.id, true)} disabled={busy}><RefreshCw size={14}/> Refresh status</Button> : <CheckCircle2 size={20}/>}</div>}
      {error && <div className="billing-inline-error"><CircleAlert size={16}/><span>{error}</span>{checkoutRecoveryUrl && <a href={checkoutRecoveryUrl}>Buka checkout QRIS</a>}</div>}
    </main>
  </div>;
}
