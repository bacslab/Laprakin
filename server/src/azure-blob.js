import { BlobServiceClient } from '@azure/storage-blob';
import { config } from './config.js';

let blobServiceClient = null;
let containerClient = null;

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

export async function uploadToBlob({ blobName, buffer, mimeType }) {
  const container = getContainerClient();
  if (!container) return null;
  const blockBlobClient = container.getBlockBlobClient(blobName);
  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: mimeType || 'application/octet-stream' },
  });
  return blockBlobClient.url;
}

export async function deleteFromBlob(blobName) {
  const container = getContainerClient();
  if (!container || !blobName) return false;
  const blockBlobClient = container.getBlockBlobClient(blobName);
  const response = await blockBlobClient.deleteIfExists();
  return response.succeeded;
}

export async function downloadFromBlob(blobName) {
  const container = getContainerClient();
  if (!container || !blobName) return null;
  const blockBlobClient = container.getBlockBlobClient(blobName);
  const downloadResponse = await blockBlobClient.download(0);
  return downloadResponse.readableStreamBody;
}
