// Runs all integration tests in the tests/ directory
import fs from 'fs';
import path from 'path';

const testsDir = path.resolve(process.cwd(), 'content-store-service', 'tests');

async function runTests() {
  const files = fs.readdirSync(testsDir).filter(f => f.endsWith('.js'));
  let passed = 0, failed = 0;
  for (const file of files) {
    const filePath = path.join(testsDir, file);
    try {
      console.log(`\n🧪 Running ${file}...`);
      // Convert Windows path to file:// URL for ESM loader compatibility
      let fileUrl = filePath;
      if (process.platform === 'win32') {
        fileUrl = 'file://' + filePath.replace(/\\/g, '/');
      }
      await import(fileUrl);
      console.log(`✅ ${file} passed`);
      passed++;
    } catch (err) {
      console.error(`❌ ${file} failed:`, err);
      failed++;
    }
  }
  console.log(`\n=== Integration Test Summary ===`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

runTests();
