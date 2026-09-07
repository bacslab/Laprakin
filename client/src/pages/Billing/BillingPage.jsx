import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, CheckCircle2, CircleAlert, CreditCard, LoaderCircle, RefreshCw } from '../../icons';
import { useLocation, useNavigate } from '../../router';
import { api } from '../../api';
import { Button } from '../../components/Button';
import { pricingFallback, pricingFeatures } from '../../data/pricing';
import { formatCurrency } from '../../lib/formatters';
import { redirectToMidtransCheckout, validatedMidtransCheckoutUrl } from '../../lib/payment-redirect';
import { useResolvedTheme } from '../../lib/theme';
import { useApp } from '../../state/ui-context';
import { useI18n } from '../../i18n/context';

export default function BillingPage() {
  const { t } = useI18n();
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

  const localizedFallbackFeatures = (key, fallback) => fallback.map((_, index) => t(`${key}.${index}`));
  const plan = data?.currentPlan || { key: 'free', label: t('billing.defaultPlan.label'), status: t('billing.defaultPlan.status'), credits: 0, endsAt: null, description: t('billing.defaultPlan.description') };
  const catalogue = {
    free: { key: 'free', label: t('billing.catalogue.free.label'), price: 0, description: t('billing.catalogue.free.description'), features: pricingFeatures(pricing.free, localizedFallbackFeatures('pricing.features.free', pricingFallback.free.features)) },
    monthly: { key: 'monthly', label: t('billing.catalogue.monthly.label'), price: pricing.monthly?.price || 29900, description: t('billing.catalogue.monthly.description'), features: pricingFeatures(pricing.monthly, localizedFallbackFeatures('pricing.features.pro', pricingFallback.monthly.features)) },
    pro: { key: 'pro', label: t('billing.catalogue.pro.label'), price: pricing.pro?.price || 45900, description: t('billing.catalogue.pro.description'), features: pricingFeatures(pricing.pro, localizedFallbackFeatures('pricing.features.max', pricingFallback.pro.features)) },
  };
  const paymentStatusCopy = {
    created: t('billing.status.created'),
    pending: t('billing.status.pending'),
    paid: t('billing.status.paid'),
    failed: t('billing.status.failed'),
    expired: t('billing.status.expired'),
    canceled: t('billing.status.canceled'),
    refunded: t('billing.status.refunded'),
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
      setNotice(successNotice || t('billing.notices.qrisVerified'));
      navigate('/app', { replace: true });
    }
  };

  const getOrder = async (orderId, verifyWithGateway = false) => {
    try {
      setBusy(verifyWithGateway);
      const response = verifyWithGateway
        ? await api(`/payments/orders/${orderId}/refresh`, { method: 'POST', body: {} })
        : await api(`/payments/orders/${orderId}`, { includeCsrf: false });
      await updateOrder(response.order, verifyWithGateway && response.order?.status === 'paid' ? t('billing.notices.paymentVerified') : t('billing.notices.paymentUpdated'));
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
    if (!cartItems.length) { setError(t('billing.errors.addProduct')); return; }
    if (!user?.emailVerified) { setError(t('billing.errors.verifyEmail')); return; }
    setBusy(true);
    setError('');
    setCheckoutRecoveryUrl('');
    try {
      const payload = await api('/payments/checkout', { method: 'POST', body: { items: cartItems } });
      if (payload.mode === 'manual') {
        await updateOrder(payload.order, t('billing.notices.localCheckout'));
        return;
      }
      await updateOrder(payload.order);
      window.sessionStorage.setItem('laprakin:active-payment-order', payload.orderId);
      const checkoutUrl = validatedMidtransCheckoutUrl(payload.checkoutUrl);
      if (!checkoutUrl) {
        throw new Error(t('billing.errors.invalidCheckoutUrl'));
      }
      setCheckoutRecoveryUrl(checkoutUrl);
      if (!redirectToMidtransCheckout(checkoutUrl)) {
        throw new Error(t('billing.errors.blockedNavigation'));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const selectSubscription = (key) => { setSubscriptionChoice(key === 'free' ? 'none' : key); setError(''); };
  return <div className={`billing-portal pricing-only ${billingTheme === 'dark' ? 'theme-dark' : 'theme-light'}`}>
    <header className="pricing-only-nav"><button className="billing-back" onClick={() => navigate('/app')} aria-label={t('billing.back')}><ArrowLeft size={18} /></button></header>
    <main className="pricing-only-main">
      <section className="pricing-only-copy"><h1>{t('billing.title')}</h1><p>{t('billing.description')}</p></section>
      <section className="pricing-only-grid">
        {['free', 'monthly', 'pro'].map((key) => {
          const item = catalogue[key];
          const current = plan.key === key;
          const isSelected = subscriptionChoice === key;
          const paid = key !== 'free';
          return <article key={key} className={`pricing-only-card ${current ? 'current' : ''} ${isSelected ? 'selected' : ''}`} onClick={() => paid && selectSubscription(key)}>
            <div className="pricing-only-card-top"><span className="pricing-only-marker" aria-hidden="true" /><small>{current ? t('billing.activePlan') : key === 'free' ? t('billing.freeStart') : t('billing.individual')}</small></div>
            <h2>{item.label}</h2><p>{item.description}</p>
            <div className="pricing-only-price"><b>{key === 'free' ? 'Rp0' : formatCurrency(item.price)}</b>{key !== 'free' && <span>{t('billing.monthlySuffix')}</span>}</div>
            <button type="button" className={current || !paid ? 'muted' : ''} onClick={(event) => { event.stopPropagation(); if (paid) selectSubscription(key); }}>
              {current ? t('billing.planActive', { label: item.label }) : !paid ? t('billing.basePlan') : isSelected ? t('billing.selected') : t('billing.choose', { label: item.label })}
            </button>
            <ul>{item.features.map((feature) => <li key={feature}><Check size={14}/>{feature}</li>)}</ul>
          </article>;
        })}
      </section>
      {subscriptionChoice !== 'none' && <section className="pricing-only-checkout"><div><small>{t('billing.checkoutEyebrow')}</small><b>{quoteBusy ? t('billing.calculating') : quote?.displayTotal || 'Rp0'}</b><span>{quote?.items?.[0]?.label || t('billing.selectedPlanFallback')} · {t('billing.validity')}</span></div><Button onClick={checkout} disabled={busy || quoteBusy || !gateway?.enabled}>{busy ? <LoaderCircle className="spin" size={15}/> : <CreditCard size={15}/>} {gateway?.enabled ? t('pricing.payWithQris') : t('pricing.gatewayInactive')}</Button></section>}
      {activeOrder && <div className={`pricing-only-status ${activeOrder.status || 'pending'}`}><div><b>{paymentStatusCopy[activeOrder.status] || activeOrder.statusLabel || t('pricing.paymentStatus')}</b><p>{paymentStatusCopy[activeOrder.status] || t('billing.status.processing')}</p></div>{activeOrder.canRefresh !== false && ['created', 'pending'].includes(activeOrder.status) ? <Button variant="secondary" onClick={() => getOrder(activeOrder.id, true)} disabled={busy}><RefreshCw size={14}/> {t('billing.refreshStatus')}</Button> : <CheckCircle2 size={20}/>}</div>}
      {error && <div className="billing-inline-error"><CircleAlert size={16}/><span>{error}</span>{checkoutRecoveryUrl && <a href={checkoutRecoveryUrl}>{t('pricing.openCheckout')}</a>}</div>}
    </main>
  </div>;
}
