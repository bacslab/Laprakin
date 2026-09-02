export function shouldSubmitComposerKey({
  key,
  shiftKey = false,
  ctrlKey = false,
  metaKey = false,
  isComposing = false,
  enterToSend = true,
}) {
  if (key !== 'Enter' || isComposing || shiftKey) return false;
  return ctrlKey || metaKey || enterToSend;
}
