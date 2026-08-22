import crypto from 'node:crypto';
import { BlobServiceClient } from '@azure/storage-blob';
import { config } from './config.js';
import { opaqueStorageName } from './utils.js';

let blobServiceClient = null;
let containerClient = null;
let privateContainerReady = null;

export function isAzureBlobConfigured() {
  return Boolean(config.azureStorageConnectionString);
}

function getContainerClient() {
  if (!config.azureStorageConnectionString) return null;
  if (!containerClient) {
    blobServiceClient = BlobServiceClient.fromConnectionString(config.azureStorageConnectionString);
    containerClient = blobServiceClient.getContainerClient(config.azureBlobContainerName || 'user-documents');
  }
  return containerClient;
}

function opaqueSegment(value, label) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new TypeError(`${label} is required`);
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 32);
}

export function privateBlobName({ ownerUserId, resourceId, originalName }) {
  return `users/${opaqueSegment(ownerUserId, 'ownerUserId')}/${opaqueSegment(resourceId, 'resourceId')}/${opaqueStorageName(originalName)}`;
}

function assertPrivateBlobName(blobName) {
  if (!/^users\/[a-f0-9]{32}\/[a-f0-9]{32}\/[0-9a-f-]{36}(?:\.[a-z0-9]{1,10})?$/.test(String(blobName || ''))) {
    throw new TypeError('Invalid private blob name');
  }
}

async function getPrivateContainerClient() {
  const container = getContainerClient();
  if (!container) return null;
  if (!privateContainerReady) {
    privateContainerReady = (async () => {
      await container.createIfNotExists();
      const currentPolicy = await container.getAccessPolicy();
      if (currentPolicy.blobPublicAccess) {
        await container.setAccessPolicy(undefined, currentPolicy.signedIdentifiers);
      }
      const verifiedPolicy = await container.getAccessPolicy();
      if (verifiedPolicy.blobPublicAccess) throw new Error('Azure Blob container must remain private');
      return container;
    })().catch((error) => {
      privateContainerReady = null;
      throw error;
    });
  }
  return privateContainerReady;
}

export async function verifyPrivateBlobContainer() {
  const container = await getPrivateContainerClient();
  if (!container) return { ok: false, code: 'AZURE_BLOB_NOT_CONFIGURED', containerName: config.azureBlobContainerName };
  return { ok: true, privateAccess: true, containerName: container.containerName };
}

export async function uploadToBlob({ ownerUserId, resourceId, originalName, buffer, mimeType }) {
  const container = await getPrivateContainerClient();
  if (!container) return null;
  const blobName = privateBlobName({ ownerUserId, resourceId, originalName });
  const blockBlobClient = container.getBlockBlobClient(blobName);
  const response = await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: mimeType || 'application/octet-stream' },
  });
  return { blobName, etag: response.etag || '' };
}

export async function deleteFromBlob(blobName) {
  const container = await getPrivateContainerClient();
  if (!container || !blobName) return false;
  assertPrivateBlobName(blobName);
  const blockBlobClient = container.getBlockBlobClient(blobName);
  const response = await blockBlobClient.deleteIfExists();
  return response.succeeded;
}

export async function downloadFromBlob(blobName) {
  const container = await getPrivateContainerClient();
  if (!container || !blobName) return null;
  assertPrivateBlobName(blobName);
  const blockBlobClient = container.getBlockBlobClient(blobName);
  const downloadResponse = await blockBlobClient.download(0);
  return downloadResponse.readableStreamBody;
}
