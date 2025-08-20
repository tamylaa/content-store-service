/**
 * End-to-End Integration Test: Content Store + Data Service + Content Skimmer
 * Verifies upload, metadata sync, and skimming process.
 */

import { uploadTestFile, checkDataServiceMetadata, DATA_SERVICE_URL, AUTH_TOKEN } from './test-helpers.js';
import assert from 'assert';

async function waitForSkimmerProcessed(fileId, maxAttempts = 15, delayMs = 2000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(`${DATA_SERVICE_URL}/files/${fileId}/skim-status`, {
      method: 'GET',
      headers: { Authorization: AUTH_TOKEN }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.skimmed === true || data.status === 'skimmed') {
        return data;
      }
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  throw new Error('Skimmer did not process the file in time');
}

(async () => {
  console.log('🧪 E2E Test: Content Store → Data Service → Content Skimmer');
  const uploadResult = await uploadTestFile();
  console.log('✅ File uploaded and metadata persisted');

  const fileId = uploadResult.file.id;
  await checkDataServiceMetadata(fileId);
  console.log('✅ Data service metadata verified');

  const skimmedData = await waitForSkimmerProcessed(fileId);
  console.log('✅ Content skimmer processed file:', skimmedData);

  assert(skimmedData.summary || skimmedData.keywords, 'Skimmer output missing expected fields');

  console.log('🎉 All E2E integration tests passed!');
})();