/**
 * Integration Test: Content Store + Data Service
 * Tests file upload, metadata persistence, and session feedback
 */

import assert from 'assert';

const CONTENT_STORE_URL = process.env.CONTENT_STORE_URL || 'http://localhost:8787';
const DATA_SERVICE_URL = process.env.DATA_SERVICE_URL || 'http://localhost:8788';
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || 'Bearer test-token';

async function uploadTestFile() {
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

async function checkSessionFeedback(userId) {
  const res = await fetch(`${CONTENT_STORE_URL}/upload-session`, {
    method: 'GET',
    headers: { Authorization: AUTH_TOKEN }
  });
  assert(res.ok, 'Session feedback endpoint failed');
  const data = await res.json();
  assert(data.success, 'Session feedback not successful');
  assert(Array.isArray(data.uploads), 'Uploads not an array');
  assert(data.uploads.length > 0, 'No uploads in session feedback');
}

async function checkDataServiceMetadata(fileId) {
  const res = await fetch(`${DATA_SERVICE_URL}/files/${fileId}`, {
    method: 'GET',
    headers: { Authorization: AUTH_TOKEN }
  });
  assert(res.ok, 'Data service metadata fetch failed');
  const data = await res.json();
  assert(data.id === fileId, 'File ID mismatch in metadata');
}

(async () => {
  console.log('🧪 Integration Test: Content Store + Data Service');
  const uploadResult = await uploadTestFile();
  console.log('✅ File uploaded and metadata persisted');
  await checkSessionFeedback(uploadResult.metadata.owner_id);
  console.log('✅ Session feedback verified');
  await checkDataServiceMetadata(uploadResult.file.id);
  console.log('✅ Data service metadata verified');
  console.log('🎉 All integration tests passed!');
})();
