export function validatedMidtransCheckoutUrl(checkoutUrl) {
  if (!checkoutUrl) return '';
  try {
    const target = new URL(checkoutUrl);
    const allowedHosts = new Set(['app.midtrans.com', 'app.sandbox.midtrans.com']);
    if (target.protocol !== 'https:' || !allowedHosts.has(target.hostname)) return '';
    return target.href;
  } catch {
    return '';
  }
}

export function redirectToMidtransCheckout(checkoutUrl) {
  const target = validatedMidtransCheckoutUrl(checkoutUrl);
  if (!target) return false;
  try {
    window.location.assign(target);
    return true;
  } catch {
    return false;
  }
}
