import { APIRequestContext } from '@playwright/test';

export async function setupTestConfig(request: APIRequestContext) {
  // Create test configuration via API
  await request.post('/api/v1/bamboo/config', {
    data: {
      provider: 'openai',
      model: 'gpt-4',
      apiKey: 'test-key'
    }
  });
}

export async function cleanupTestData(request: APIRequestContext) {
  // Delete test workflows
  const workflows = await request.get('/api/v1/bamboo/workflows');
  const data = await workflows.json();

  for (const workflow of data.workflows || []) {
    if (workflow.name.startsWith('test-')) {
      await request.delete(`/api/v1/bamboo/workflows/${workflow.name}`);
    }
  }

  // Delete test keywords
  const keywords = await request.get('/api/v1/bamboo/keywords');
  const keywordData = await keywords.json();

  for (const keyword of keywordData.keywords || []) {
    if (keyword.startsWith('test-')) {
      await request.delete(`/api/v1/bamboo/keywords/${keyword}`);
    }
  }
}

export async function waitForBackendHealth(request: APIRequestContext, maxRetries = 10) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await request.get('/api/v1/health');
      if (response.ok()) {
        const health = await response.json();
        if (health.status === 'ok') {
          return true;
        }
      }
    } catch (e) {
      // Continue retrying
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Backend health check failed');
}

export async function createTestWorkflow(request: APIRequestContext, name: string, content: string) {
  const response = await request.post('/api/v1/bamboo/workflows', {
    data: {
      name,
      content
    }
  });

  if (!response.ok()) {
    throw new Error(`Failed to create test workflow: ${await response.text()}`);
  }

  return await response.json();
}

export async function deleteTestWorkflow(request: APIRequestContext, name: string) {
  const response = await request.delete(`/api/v1/bamboo/workflows/${name}`);

  if (!response.ok() && response.status() !== 404) {
    throw new Error(`Failed to delete test workflow: ${await response.text()}`);
  }
}

export async function createTestKeyword(request: APIRequestContext, keyword: string) {
  const response = await request.post('/api/v1/bamboo/keywords', {
    data: { keyword }
  });

  if (!response.ok()) {
    throw new Error(`Failed to create test keyword: ${await response.text()}`);
  }

  return await response.json();
}

export async function deleteTestKeyword(request: APIRequestContext, keyword: string) {
  const response = await request.delete(`/api/v1/bamboo/keywords/${encodeURIComponent(keyword)}`);

  if (!response.ok() && response.status() !== 404) {
    throw new Error(`Failed to delete test keyword: ${await response.text()}`);
  }
}

export async function sendMessage(request: APIRequestContext, message: string, conversationId?: string) {
  const response = await request.post('/api/v1/bamboo/chat', {
    data: {
      message,
      conversationId
    }
  });

  if (!response.ok()) {
    throw new Error(`Failed to send message: ${await response.text()}`);
  }

  return await response.json();
}

export async function waitForStreamingCompletion(request: APIRequestContext, messageId: string, maxWait = 30000) {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    const response = await request.get(`/api/v1/bamboo/messages/${messageId}/status`);

    if (response.ok()) {
      const status = await response.json();
      if (status.complete) {
        return true;
      }
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  throw new Error('Streaming did not complete within timeout');
}

export async function getConversationHistory(request: APIRequestContext, conversationId: string) {
  const response = await request.get(`/api/v1/bamboo/conversations/${conversationId}/messages`);

  if (!response.ok()) {
    throw new Error(`Failed to get conversation history: ${await response.text()}`);
  }

  return await response.json();
}
