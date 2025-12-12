/**
 * Self-test script for saudi-standards-api
 * Tests all endpoints and reports pass/fail status
 */

const API_URL = process.env.API_URL || 'http://localhost:3000';

interface TestResult {
  endpoint: string;
  status: number;
  success: boolean;
  message: string;
}

async function testEndpoint(
  name: string,
  method: string,
  path: string,
  body?: any
): Promise<TestResult> {
  try {
    const url = `${API_URL}${path}`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const status = response.status;
    const data = await response.json();

    let success = false;
    let message = '';

    if (path === '/health') {
      const recordsLoaded = (data as any).recordsLoaded || 0;
      success = status === 200 && recordsLoaded > 0;
      message = success
        ? `OK - ${recordsLoaded} records loaded`
        : `FAIL - Expected recordsLoaded > 0, got ${recordsLoaded}`;
    } else if (path === '/standards/searchRequirements') {
      const results = (data as any).results || [];
      success = status === 200 && results.length > 0;
      message = success
        ? `OK - ${results.length} results found`
        : `FAIL - Expected results.length > 0, got ${results.length}`;
    } else if (path === '/standards/generateChecklist') {
      const checklist = (data as any).checklist || [];
      success = status === 200 && checklist.length > 0;
      message = success
        ? `OK - ${checklist.length} checklist items`
        : `FAIL - Expected checklist.length > 0, got ${checklist.length}`;
    } else if (path === '/standards/getReference') {
      const hasData = data && typeof data === 'object' && !('error' in data);
      success = status === 200 && Boolean(hasData);
      message = success
        ? `OK - Reference found: ${(data as any).reference || 'N/A'}`
        : `FAIL - Reference not found or error returned`;
    } else {
      success = status === 200;
      message = success ? 'OK' : `FAIL - Status ${status}`;
    }

    return {
      endpoint: name,
      status,
      success,
      message,
    };
  } catch (error) {
    return {
      endpoint: name,
      status: 0,
      success: false,
      message: `ERROR - ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function runTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Saudi Standards API - Self Test');
  console.log(`Testing API at: ${API_URL}`);
  console.log('='.repeat(60));
  console.log('');

  const results: TestResult[] = [];

  // Test 1: GET /health
  console.log('Test 1: GET /health');
  const healthResult = await testEndpoint('GET /health', 'GET', '/health');
  results.push(healthResult);
  console.log(`  Status: ${healthResult.status}`);
  console.log(`  Result: ${healthResult.message}`);
  console.log('');

  // Test 2: POST /standards/searchRequirements
  console.log('Test 2: POST /standards/searchRequirements');
  const searchBody = {
    standard: 'HCIS_SEC',
    query: 'security',
    limit: 3,
  };
  const searchResult = await testEndpoint(
    'POST /standards/searchRequirements',
    'POST',
    '/standards/searchRequirements',
    searchBody
  );
  results.push(searchResult);
  console.log(`  Request: ${JSON.stringify(searchBody)}`);
  console.log(`  Status: ${searchResult.status}`);
  console.log(`  Result: ${searchResult.message}`);
  console.log('');

  // Test 3: POST /standards/generateChecklist
  console.log('Test 3: POST /standards/generateChecklist');
  const checklistBody = {
    standards: ['HCIS_SEC', 'SBC_801', 'SASO_FIRE_TR'],
  };
  const checklistResult = await testEndpoint(
    'POST /standards/generateChecklist',
    'POST',
    '/standards/generateChecklist',
    checklistBody
  );
  results.push(checklistResult);
  console.log(`  Request: ${JSON.stringify(checklistBody)}`);
  console.log(`  Status: ${checklistResult.status}`);
  console.log(`  Result: ${checklistResult.message}`);
  console.log('');

  // Test 4: POST /standards/getReference
  console.log('Test 4: POST /standards/getReference');
  const referenceBody = {
    reference: 'HCIS SEC-01 4.4.1',
  };
  const referenceResult = await testEndpoint(
    'POST /standards/getReference',
    'POST',
    '/standards/getReference',
    referenceBody
  );
  results.push(referenceResult);
  console.log(`  Request: ${JSON.stringify(referenceBody)}`);
  console.log(`  Status: ${referenceResult.status}`);
  console.log(`  Result: ${referenceResult.message}`);
  console.log('');

  // Summary
  console.log('='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  results.forEach((result) => {
    const icon = result.success ? '✓' : '✗';
    console.log(`${icon} ${result.endpoint}: ${result.message}`);
  });
  console.log('');

  const allPassed = results.every((r) => r.success);
  const passedCount = results.filter((r) => r.success).length;
  const totalCount = results.length;

  console.log(`Results: ${passedCount}/${totalCount} tests passed`);

  if (allPassed) {
    console.log('');
    console.log('✓ ALL TESTS PASSED');
    process.exit(0);
  } else {
    console.log('');
    console.log('✗ SOME TESTS FAILED');
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});

