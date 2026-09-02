import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, CircleAlert, CreditCard, LoaderCircle, RefreshCw } from 'lucide-react';
import { Link, useLocation, useNavigate } from '../../router';
import { api } from '../../api';
import { Button } from '../../components/Button';
import { pricingFallback, pricingFeatures } from '../../data/pricing';
import { formatCurrency } from '../../lib/formatters';
import { redirectToMidtransCheckout, validatedMidtransCheckoutUrl } from '../../lib/payment-redirect';
import { useResolvedTheme } from '../../lib/theme';
import { useApp } from '../../state/ui-context';

export default function PublicPricingPage() {
  const { user, prefs, setNotice, refreshSession } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const isCheckoutPage = location.pathname === '/checkout';
  const resolvedTheme = useResolvedTheme(prefs.theme || 'system');
  const params = new URLSearchParams(location.search);
  const normalizePlan = (value) => value === 'single' ? 'credit' : ['credit', 'monthly', 'pro'].includes(value) ? value : '';
  const requestedPlan = normalizePlan(params.get('plan') || '');
  const requestedQty = Math.max(1, Math.min(20, Number(params.get('quantity') || 1) || 1));
  const [pricing, setPricing] = useState(pricingFallback);
  const [billing, setBilling] = useState(null);
  const [gateway, setGateway] = useState(null);
  const [selected, setSelected] = useState(requestedPlan);
  const [creditQuantity, setCreditQuantity] = useState(requestedQty);
  const [quote, setQuote] = useState(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeOrder, setActiveOrder] = useState(null);
  const [checkoutRecoveryUrl, setCheckoutRecoveryUrl] = useState('');
  const [error, setError] = useState('');
  const paymentReturn = params.get('payment') || '';

  const loadPricing = useCallback(async () => {
    try {
      const nextPricing = await api('/pricing', { includeCsrf: false });
      setPricing(nextPricing || pricingFallback);
      if (!user) {
        setBilling(null);
        setGateway(null);
        return;
      }
      const [nextBilling, paymentConfig] = await Promise.all([
        api('/billing'),
        api('/payments/config', { includeCsrf: false }),
      ]);
      setBilling(nextBilling);
      setGateway(paymentConfig);
      const pending = (nextBilling.orders || []).find((order) => ['created', 'pending'].includes(order.status));
      if (pending) setActiveOrder((current) => current?.id === pending.id ? current : { ...pending, canRefresh: true });
    } catch (err) {
      setError(err.message);
    }
  }, [user]);

  useEffect(() => { loadPricing(); }, [loadPricing]);
  useEffect(() => { setSelected(requestedPlan); }, [requestedPlan]);
  useEffect(() => { setCreditQuantity(requestedQty); }, [requestedQty]);
  useEffect(() => {
    if (!['canceled', 'cancelled', 'failed', 'error'].includes(paymentReturn)) return;
    window.sessionStorage.removeItem('laprakin:active-payment-order');
    if (location.pathname !== '/pricing' || location.search) navigate('/pricing', { replace: true });
  }, [paymentReturn, location.pathname, location.search, navigate]);

  const cartItems = useMemo(() => {
    if (!selected) return [];
    return [{ sku: selected, quantity: selected === 'credit' ? creditQuantity : 1 }];
  }, [selected, creditQuantity]);
  const cartKey = cartItems.map((item) => `${item.sku}:${item.quantity}`).join('|');

  useEffect(() => {
    let cancelled = false;
    if (!user || !cartItems.length) {
      setQuote(null);
      return undefined;
    }
    setQuoteBusy(true);
    api('/pricing/quote', { method: 'POST', body: { items: cartItems } })
      .then((next) => { if (!cancelled) setQuote(next); })
      .catch((err) => { if (!cancelled) { setQuote(null); setError(err.message); } })
      .finally(() => { if (!cancelled) setQuoteBusy(false); });
    return () => { cancelled = true; };
  }, [user, cartKey]);

  const currentPlanKey = billing?.currentPlan?.key || 'free';
  const maxCreditQty = pricing.single?.maxQuantity || 20;
  const cards = [
    {
      key: 'free', label: 'Free', note: 'Mulai tanpa biaya', price: 'Rp0', suffix: '',
      features: pricingFeatures(pricing.free, pricingFallback.free.features),
    },
    {
      key: 'credit', label: 'Satuan', note: 'Bayar sesuai kebutuhan', price: formatCurrency(pricing.single?.unitPrice || 3900), originalPrice: formatCurrency(pricing.single?.originalPrice || pricing.single?.unitPrice || 3900), discountPercent: pricing.single?.discountPercent || 0, suffix: '/ laprak',
      features: pricingFeatures(pricing.single, pricingFallback.single.features),
    },
    {
      key: 'monthly', label: 'Pro', note: 'Untuk laprak harian', recommended: true, price: formatCurrency(pricing.monthly?.price || 29900), originalPrice: formatCurrency(pricing.monthly?.originalPrice || pricing.monthly?.price || 29900), discountPercent: pricing.monthly?.discountPercent || 0, suffix: '/ 30 hari',
      features: pricingFeatures(pricing.monthly, pricingFallback.monthly.features),
    },
    {
      key: 'pro', label: 'Max', note: 'Untuk semester padat', price: formatCurrency(pricing.pro?.price || 45900), originalPrice: formatCurrency(pricing.pro?.originalPrice || pricing.pro?.price || 45900), discountPercent: pricing.pro?.discountPercent || 0, suffix: '/ 30 hari',
      features: pricingFeatures(pricing.pro, pricingFallback.pro.features),
    },
  ];

  const updateSelectedUrl = (key, quantity = creditQuantity) => {
    const query = new URLSearchParams();
    query.set('plan', key);
    if (key === 'credit') query.set('quantity', String(quantity));
    navigate(`${isCheckoutPage ? '/checkout' : '/pricing'}?${query.toString()}`, { replace: true });
  };

  const selectProduct = (key) => {
    if (key === 'free') {
      navigate(user ? '/app' : '/auth');
      return;
    }
    if (!user) {
      const query = new URLSearchParams();
      query.set('plan', key);
      if (key === 'credit') query.set('quantity', String(creditQuantity));
      const next = `/checkout?${query.toString()}`;
      navigate(`/auth?next=${encodeURIComponent(next)}`);
      return;
    }
    setError('');
    setSelected(key);
    const query = new URLSearchParams();
    query.set('plan', key);
    if (key === 'credit') query.set('quantity', String(creditQuantity));
    navigate(`/checkout?${query.toString()}`);
  };

  const updateCreditQuantity = (nextQuantity) => {
    const next = Math.max(1, Math.min(maxCreditQty, Number(nextQuantity) || 1));
    setCreditQuantity(next);
    if (selected === 'credit') updateSelectedUrl('credit', next);
  };

  const updateOrder = async (order, notice = '') => {
    setActiveOrder(order);
    if (order?.id && ['created', 'pending'].includes(order.status)) window.sessionStorage.setItem('laprakin:active-payment-order', order.id);
    if (order?.id && ['paid', 'failed', 'expired', 'canceled', 'refunded'].includes(order.status)) window.sessionStorage.removeItem('laprakin:active-payment-order');
    if (order?.status === 'paid') {
      await refreshSession();
      await loadPricing();
      setNotice(notice || 'Pembayaran QRIS berhasil diverifikasi. Produk sudah aktif.');
      navigate('/app', { replace: true });
    }
  };

  const refreshOrder = async (orderId, verifyWithGateway = true) => {
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
    const orderId = window.sessionStorage.getItem('laprakin:active-payment-order');
    if (!user || !orderId) return;
    const returned = new URLSearchParams(window.location.search).get('payment') === 'finished';
    refreshOrder(orderId, returned);
  }, [user]);

  useEffect(() => {
    if (!activeOrder?.id || !['created', 'pending'].includes(activeOrder.status)) return undefined;
    const timer = window.setInterval(() => refreshOrder(activeOrder.id, false), 10_000);
    return () => window.clearInterval(timer);
  }, [activeOrder?.id, activeOrder?.status]);

  const checkout = async () => {
    if (!user) return selectProduct(selected || 'monthly');
    if (!cartItems.length) return setError('Pilih plan atau credit terlebih dahulu.');
    if (!user.emailVerified) return setError('Verifikasi email sebelum melakukan pembayaran.');
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

  const statusCopy = {
    created: 'Menyiapkan checkout QRIS.',
    pending: 'Menunggu pembayaran. Scan QRIS di checkout Midtrans.',
    paid: 'Pembayaran berhasil. Produk sudah aktif.',
    failed: 'Pembayaran ditolak. Buat checkout baru untuk mencoba lagi.',
    expired: 'Kode QRIS sudah kedaluwarsa. Buat checkout baru.',
    canceled: 'Checkout dibatalkan. Belum ada produk yang ditambahkan.',
  };

  return <div className={`pricing-compact-page ${isCheckoutPage ? 'pricing-checkout-page' : ''} ${resolvedTheme === 'dark' ? 'theme-dark' : 'theme-light'}`}>
    {/* Dari halaman checkout, Kembali harus mengembalikan ke daftar plan supaya
    user dapat mengganti pilihan; hanya dari daftar plan ia keluar ke workspace. */}
    <header className="pricing-compact-nav"><button type="button" onClick={() => (isCheckoutPage ? navigate('/pricing') : navigate(user ? '/app' : '/'))} aria-label={isCheckoutPage ? 'Kembali ke pilihan plan' : 'Kembali'} title={isCheckoutPage ? 'Kembali ke pilihan plan' : 'Kembali'}><ArrowLeft size={18}/></button></header>
    <main className="pricing-compact-main">
      <section className="pricing-compact-intro" aria-labelledby="pricing-compact-title">
        <span>Pilihan Laprakin</span>
        <h1 id="pricing-compact-title">{isCheckoutPage ? 'Selesaikan pembayaran.' : 'Pilih plan yang pas buat kamu.'}</h1>
        <p>{isCheckoutPage ? 'Cek ringkasan pembelian, lalu lanjutkan ke QRIS Midtrans.' : 'Mulai gratis, beli credit satuan, atau pilih akses bulanan sesuai ritme praktikum.'}</p>
      </section>
      {!isCheckoutPage && <section className="pricing-compact-grid" aria-label="Pilihan plan Laprakin">
        {cards.map((card) => {
          const isFree = card.key === 'free';
          const isCurrent = card.key === currentPlanKey;
          const isSelected = card.key === selected;
          const actionLabel = isFree ? (user ? 'Masuk workspace' : 'Mulai gratis') : isSelected && user ? 'Dipilih' : `Pilih ${card.label}`;
          return <article key={card.key} className={`pricing-compact-card ${card.recommended ? 'is-recommended' : ''} ${isSelected ? 'is-selected' : ''} ${isCurrent ? 'is-current' : ''}`}>
            {card.recommended && <span className="pricing-recommended-badge">Rekomendasi</span>}
            <div className="pricing-compact-card-head"><div><b>{card.label}</b><small>{isCurrent ? 'Plan aktif' : card.note}</small></div></div>
            <div className="pricing-compact-price">{card.discountPercent > 0 && <small className="pricing-original-price">{card.originalPrice}</small>}<strong>{card.price}</strong>{card.suffix && <span>{card.suffix}</span>}{card.discountPercent > 0 && <em>Hemat {card.discountPercent}%</em>}</div>
            <div className="pricing-compact-action-slot">
              {card.key === 'credit' ? <div className="pricing-compact-quantity" onClick={(event) => event.stopPropagation()}><span>Jumlah</span><div><button type="button" aria-label="Kurangi credit" onClick={() => updateCreditQuantity(creditQuantity - 1)}>-</button><b>{creditQuantity}</b><button type="button" aria-label="Tambah credit" onClick={() => updateCreditQuantity(creditQuantity + 1)}>+</button></div></div> : <span className="pricing-compact-quantity-placeholder" aria-hidden="true" />}
            </div>
            <button type="button" className={isCurrent || isFree ? 'is-quiet' : ''} onClick={() => selectProduct(card.key)}>{actionLabel}{!isFree && <ArrowRight size={15}/>}</button>
            <div className="pricing-compact-divider" />
            <ul>{card.features.map((feature) => <li key={feature}><Check size={13}/><span>{feature}</span></li>)}</ul>
          </article>;
        })}
      </section>}
      {user && selected && isCheckoutPage && <section className="checkout-summary" aria-live="polite">
        <header className="checkout-summary-head">
          <div><b>Ringkasan pesanan</b><small>Periksa kembali sebelum membayar.</small></div>
          <Link to="/pricing" className="checkout-change-plan">Ubah pilihan</Link>
        </header>

        <ul className="checkout-lines">
          {(quote?.items || []).map((item) => <li key={item.sku}>
            <div>
              <b>{item.label}{item.quantity > 1 ? ` × ${item.quantity}` : ''}</b>
              <small>
                {item.kind === 'subscription'
                  ? `${item.creditPerUnit} credit · aktif ${item.durationDays} hari`
                  : `${item.creditPerUnit * item.quantity} credit · berlaku 180 hari`}
              </small>
            </div>
            <span>{formatCurrency(item.subtotalIdr)}</span>
          </li>)}
          {!quote?.items?.length && <li className="checkout-lines-empty"><span>{quoteBusy ? 'Menghitung pesanan…' : 'Belum ada produk terpilih.'}</span></li>}
        </ul>

        {Number(quote?.discountIdr || 0) > 0 && <div className="checkout-discount"><span>Subtotal <s>{formatCurrency(quote.subtotalIdr)}</s></span><b>Diskon -{formatCurrency(quote.discountIdr)}</b></div>}
        <div className="checkout-total">
          <div><span>Total</span><small>Sudah termasuk seluruh biaya.</small></div>
          <b>{quoteBusy ? 'Menghitung…' : quote?.displayTotal || 'Rp0'}</b>
        </div>

        {quote?.totalCredits > 0 && <p className="checkout-gain"><Check size={14} />Kamu mendapat <b>{quote.totalCredits} credit</b> begitu pembayaran terverifikasi.</p>}

        <Button className="checkout-pay-button" onClick={checkout} disabled={busy || quoteBusy || !gateway?.enabled}>
          {busy ? <LoaderCircle className="spin" size={15}/> : <CreditCard size={15}/>} {gateway?.enabled ? 'Bayar dengan QRIS' : 'Gateway belum aktif'}
        </Button>

        <ul className="checkout-notes">
          <li>Scan QRIS memakai aplikasi bank atau e-wallet apa pun.</li>
          <li>Kode QRIS berlaku 15 menit. Lewat itu, buat pesanan baru.</li>
          <li>Credit masuk otomatis setelah pembayaran diverifikasi—tidak perlu konfirmasi manual.</li>
        </ul>
      </section>}
      {activeOrder && <section className={`pricing-compact-status ${activeOrder.status || 'pending'}`}><div><b>{activeOrder.statusLabel || 'Status pembayaran'}</b><p>{statusCopy[activeOrder.status] || 'Status pembayaran sedang diproses.'}</p></div>{['created', 'pending'].includes(activeOrder.status) ? <button type="button" onClick={() => refreshOrder(activeOrder.id, true)} disabled={busy}><RefreshCw size={14}/>Refresh</button> : <CheckCircle2 size={20}/>}</section>}
      {error && <div className="pricing-compact-error"><CircleAlert size={16}/><span>{error}</span>{checkoutRecoveryUrl && <a href={checkoutRecoveryUrl}>Buka checkout QRIS</a>}</div>}
    </main>
  </div>;
}
