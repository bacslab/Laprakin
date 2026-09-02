import { canonicalCourseLabel, courseAcronym, courseTokens, editDistance, normalizedCourseKey } from './academic.js';
import { DARK_ONLY_ACCENTS, LIGHT_FALLBACK_ACCENT, workspaceAccents } from '../data/workspace.js';

export const defaultChatConfig = {
  title: 'Laprak baru',
  structureMode: 'guided',
  configuration: { courseName: '', moduleTitle: '', lecturerName: '', lecturerNip: '', documentProfile: 'langkah', customStructure: '', instructions: '', tone: 'formal', perspective: 'saya', allowExternalAi: false },
};

export function resolveAccent(accentKey, resolvedTheme) {
  const requested = workspaceAccents.find((item) => item.key === accentKey) || workspaceAccents[0];
  if (resolvedTheme !== 'light' || !DARK_ONLY_ACCENTS.has(requested.key)) return requested;
  return workspaceAccents.find((item) => item.key === LIGHT_FALLBACK_ACCENT) || requested;
}

const LANDING_DRAFT_KEY = 'laprakin-landing-draft';

function openLandingDraftDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('laprakin-landing-drafts', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('drafts');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function takeLandingDraft() {
  const prompt = sessionStorage.getItem(LANDING_DRAFT_KEY) || '';
  sessionStorage.removeItem(LANDING_DRAFT_KEY);
  let files = [];
  try {
    const db = await openLandingDraftDb();
    const tx = db.transaction('drafts', 'readwrite');
    const request = tx.objectStore('drafts').get('pending');
    files = await new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
    tx.objectStore('drafts').delete('pending');
    db.close();
  } catch { /* no local files */ }
  return { prompt, files };
}

function fileKey(file) {
  return `${file?.name || 'file'}:${file?.size || 0}:${file?.lastModified || 0}`;
}

export function mergeFiles(existing = [], incoming = []) {
  const keys = new Set(existing.map(fileKey));
  return [...existing, ...incoming.filter((file) => file && !keys.has(fileKey(file)))];
}

export function clipboardImageFiles(event) {
  const items = Array.from(event.clipboardData?.items || []);
  return items
    .filter((item) => item.type?.startsWith('image/'))
    .map((item, index) => {
      const blob = item.getAsFile();
      if (!blob) return null;
      const ext = blob.type.split('/')[1] || 'png';
      return new File([blob], `gambar-clipboard-${Date.now()}-${index + 1}.${ext}`, { type: blob.type || 'image/png' });
    })
    .filter(Boolean);
}

export function courseLabelsMatch(left, right) {
  const a = normalizedCourseKey(left);
  const b = normalizedCourseKey(right);
  if (a === b) return true;
  if (a === 'belum dikelompokkan' || b === 'belum dikelompokkan') return false;
  const acronymA = courseAcronym(a);
  const acronymB = courseAcronym(b);
  if (acronymA.length >= 2 && acronymA === acronymB) return true;
  const compactA = a.replace(/\s+/g, '');
  const compactB = b.replace(/\s+/g, '');
  if (Math.min(compactA.length, compactB.length) < 7) return false;
  return 1 - (editDistance(compactA, compactB) / Math.max(compactA.length, compactB.length)) >= 0.84;
}

export function preferredCourseLabel(left, right) {
  const leftTokens = courseTokens(left).length;
  const rightTokens = courseTokens(right).length;
  if (leftTokens !== rightTokens) return leftTokens > rightTokens ? left : right;
  return String(left).length >= String(right).length ? left : right;
}

export { canonicalCourseLabel };
