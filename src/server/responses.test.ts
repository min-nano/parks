import { describe, expect, it } from 'vitest';

import { badRequest, jsonResponse, notFound, readJsonBody, unauthorized } from './responses';

describe('jsonResponse', () => {
  it('defaults to 200 and JSON content', async () => {
    const response = jsonResponse({ hello: 'world' });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    await expect(response.json()).resolves.toEqual({ hello: 'world' });
  });

  it('accepts an explicit status', () => {
    expect(jsonResponse({}, 201).status).toBe(201);
  });
});

describe('error helpers', () => {
  it('builds a 400 with issues', async () => {
    const response = badRequest('invalid report', [{ path: 'status', message: 'required' }]);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'invalid report',
      issues: [{ path: 'status', message: 'required' }],
    });
  });

  it('defaults the issue list to empty', async () => {
    await expect(badRequest('nope').json()).resolves.toEqual({ error: 'nope', issues: [] });
  });

  it('builds a 401', async () => {
    const response = unauthorized();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'sign in required' });
  });

  it('builds a 404 with a default and a custom message', async () => {
    await expect(notFound().json()).resolves.toEqual({ error: 'not found' });

    const custom = notFound('parking not found');
    expect(custom.status).toBe(404);
    await expect(custom.json()).resolves.toEqual({ error: 'parking not found' });
  });
});

describe('readJsonBody', () => {
  it('parses a JSON body', async () => {
    const request = new Request('https://example.com', {
      method: 'POST',
      body: JSON.stringify({ status: 'full' }),
    });

    await expect(readJsonBody(request)).resolves.toEqual({ status: 'full' });
  });

  it('returns undefined for a malformed body', async () => {
    const request = new Request('https://example.com', { method: 'POST', body: '{oops' });

    await expect(readJsonBody(request)).resolves.toBeUndefined();
  });
});
