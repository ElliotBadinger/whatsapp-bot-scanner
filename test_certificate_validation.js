const { certificateIntelligence } = require('./packages/shared/dist/reputation/certificate-intelligence');

async function testCertificateValidation() {
  console.log('Testing certificate validation with hostname verification...\n');
  
  // Test 1: Valid certificate with correct hostname
  console.log('Test 1: Valid certificate (google.com)');
  try {
    const result1 = await certificateIntelligence('google.com', { timeoutMs: 3000, ctCheckEnabled: false });
    console.log('✓ Valid certificate test passed');
    console.log(`  - Valid: ${result1.isValid}`);
    console.log(`  - Suspicion Score: ${result1.suspicionScore}`);
    console.log(`  - Reasons: ${result1.reasons.join(', ') || 'None'}\n`);
  } catch (err) {
    console.log('✗ Valid certificate test failed:', err.message, '\n');
  }
  
  // Test 2: Self-signed certificate
  console.log('Test 2: Self-signed certificate (self-signed.badssl.com)');
  try {
    const result2 = await certificateIntelligence('self-signed.badssl.com', { timeoutMs: 3000, ctCheckEnabled: false });
    console.log('✓ Self-signed certificate test passed');
    console.log(`  - Valid: ${result2.isValid}`);
    console.log(`  - Self-signed: ${result2.isSelfSigned}`);
    console.log(`  - Suspicion Score: ${result2.suspicionScore}`);
    console.log(`  - Reasons: ${result2.reasons.join(', ')}\n`);
  } catch (err) {
    console.log('✗ Self-signed certificate test failed:', err.message, '\n');
  }
  
  // Test 3: Wrong hostname in certificate
  console.log('Test 3: Wrong hostname (wrong.host.badssl.com)');
  try {
    const result3 = await certificateIntelligence('wrong.host.badssl.com', { timeoutMs: 3000, ctCheckEnabled: false });
    console.log('✓ Wrong hostname test passed');
    console.log(`  - Valid: ${result3.isValid}`);
    console.log(`  - Suspicion Score: ${result3.suspicionScore}`);
    console.log(`  - Reasons: ${result3.reasons.join(', ')}\n`);
  } catch (err) {
    console.log('✗ Wrong hostname test failed:', err.message, '\n');
  }
  
  // Test 4: Expired certificate
  console.log('Test 4: Expired certificate (expired.badssl.com)');
  try {
    const result4 = await certificateIntelligence('expired.badssl.com', { timeoutMs: 3000, ctCheckEnabled: false });
    console.log('✓ Expired certificate test passed');
    console.log(`  - Valid: ${result4.isValid}`);
    console.log(`  - Suspicion Score: ${result4.suspicionScore}`);
    console.log(`  - Reasons: ${result4.reasons.join(', ')}\n`);
  } catch (err) {
    console.log('✗ Expired certificate test failed:', err.message, '\n');
  }
  
  console.log('Certificate validation tests completed!');
}

// Build the package first
const { exec } = require('child_process');
exec('npm run build', (err, stdout, stderr) => {
  if (err) {
    console.error('Build failed:', err);
    process.exit(1);
  }
  console.log('Build completed, running tests...\n');
  testCertificateValidation().catch(console.error);
});