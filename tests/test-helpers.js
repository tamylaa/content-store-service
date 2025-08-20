import assert from 'assert';

export const CONTENT_STORE_URL = process.env.CONTENT_STORE_URL || 'https://content.tamyla.com';
export const DATA_SERVICE_URL = process.env.DATA_SERVICE_URL || 'https://data-service.tamylatrading.workers.dev';
export const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || 'Bearer test-token';

export async function uploadTestFile() {
  const file = new Blob(['Hello, world!'], { type: 'text/plain' });
  const formData = new FormData();
  formData.append('file', file, 'test.txt');
  formData.append('category', 'test');

  const res = await fetch(`${CONTENT_STORE_URL}/upload`, {
    method: 'POST',
    headers: { Authorization: AUTH_TOKEN },
    body: formData
  });
  assert(res.ok, 'Upload failed');
  const data = await res.json();
  assert(data.success !== false, 'Upload response not successful');
  assert(data.file && data.file.id, 'No file metadata in response');
  assert(data.metadata && data.metadata.id, 'No metadata persisted');
  return data;
}

export async function checkDataServiceMetadata(fileId) {
  const res = await fetch(`${DATA_SERVICE_URL}/files/${fileId}`, {
    method: 'GET',
    headers: { Authorization: AUTH_TOKEN }
  });
  assert(res.ok, 'Data service metadata fetch failed');
  const data = await res.json();
  assert(data.id === fileId, 'File ID mismatch in metadata');
  return data;
}