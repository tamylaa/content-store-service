/**
 * Integration Test: Content Store + Data Service
 * Tests file upload, metadata persistence, and session feedback
 */

import { uploadTestFile, checkDataServiceMetadata, CONTENT_STORE_URL, AUTH_TOKEN } from './test-helpers.js';
import assert from 'assert';

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
