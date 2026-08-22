import AdmZip from 'adm-zip';

export const ARCHIVE_LIMITS = Object.freeze({
  maxEntries: 200,
  maxTotalUncompressedBytes: 75 * 1024 * 1024,
  maxEntryUncompressedBytes: 12 * 1024 * 1024,
  maxXmlEntryUncompressedBytes: 8 * 1024 * 1024,
  maxCompressionRatio: 100,
});

export class ArchiveSafetyError extends Error {
  constructor(reason = 'unsafe archive') {
    super('Arsip dokumen tidak aman atau melebihi batas pemrosesan.');
    this.name = 'ArchiveSafetyError';
    this.code = 'ARCHIVE_UNSAFE';
    this.status = 400;
    this.reason = reason;
  }
}

function reject(reason) {
  throw new ArchiveSafetyError(reason);
}

function numericHeaderValue(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

function hasUnsafePath(entryName) {
  const name = String(entryName || '').replaceAll('\\', '/');
  if (!name || name.includes('\u0000') || name.startsWith('/') || /^[A-Za-z]:\//.test(name)) return true;
  return name.split('/').some((part) => part === '..');
}

export function validateArchiveEntries(entries, limits = ARCHIVE_LIMITS) {
  const list = Array.from(entries || []);
  if (list.length > limits.maxEntries) reject('entry_count');

  let totalUncompressedBytes = 0;
  for (const entry of list) {
    if (hasUnsafePath(entry.entryName)) reject('path');
    if (entry.isDirectory) continue;

    const flags = numericHeaderValue(entry.header?.flags) || 0;
    if (entry.encrypted || (flags & 0x1) === 0x1) reject('encrypted');

    const uncompressedBytes = numericHeaderValue(entry.header?.size);
    const compressedBytes = numericHeaderValue(entry.header?.compressedSize);
    if (uncompressedBytes === null || compressedBytes === null) reject('invalid_size');
    if (uncompressedBytes > limits.maxEntryUncompressedBytes) reject('entry_size');

    const normalizedName = String(entry.entryName || '').replaceAll('\\', '/').toLowerCase();
    if (normalizedName.endsWith('.xml') && uncompressedBytes > limits.maxXmlEntryUncompressedBytes) reject('xml_size');

    totalUncompressedBytes += uncompressedBytes;
    if (totalUncompressedBytes > limits.maxTotalUncompressedBytes) reject('total_size');

    if (uncompressedBytes > 0) {
      if (compressedBytes === 0 || uncompressedBytes / compressedBytes > limits.maxCompressionRatio) reject('compression_ratio');
    }
  }

  return { entries: list.length, totalUncompressedBytes };
}

export function openSafeZip(source, limits = ARCHIVE_LIMITS) {
  let zip;
  try {
    zip = source instanceof AdmZip ? source : new AdmZip(source);
  } catch {
    reject('invalid_archive');
  }
  validateArchiveEntries(zip.getEntries(), limits);
  return zip;
}

export function validateArchiveFile(filePath, limits = ARCHIVE_LIMITS) {
  openSafeZip(filePath, limits);
  return true;
}
