import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../src/lib/api.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const api = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
globalThis.window = new EventTarget();
const realFetch = globalThis.fetch;
let checks = 0;
try {
  const routes = {
    '/api/auth/login': { data: { accessToken: 'test-token', user: { id: 7, fullName: 'Test Customer', role: 'CUSTOMER' } } },
    '/api/users/me': { data: { id: 7, fullName: 'Test Customer', phoneNumber: '0901234567' } },
    '/api/cinemas': { data: [{ id: 1, name: 'Test Cinema', rooms: [{ id: 2, name: 'Room 2' }] }] },
    '/api/cinemas/1': { data: { id: 1, name: 'Test Cinema' } },
    '/api/cinemas/1/rooms': { data: [{ id: 2, name: 'Room 2' }] },
    '/api/seats/room/2': { data: [{ id: 3, label: 'A1', row: 'A', column: 1, type: 'VIP', priceCoefficient: '1.5', status: 'AVAILABLE' }] },
  };
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input);
    assert.ok(routes[url.pathname], `Unexpected endpoint: ${url.pathname}`);
    if (url.pathname === '/api/users/me') assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer test-token');
    return Response.json({ statusCode: 200, success: true, ...routes[url.pathname] });
  };
  storage.set('refreshToken', 'stale-refresh-token');
  await api.login('test@example.com', 'test-password');
  assert.equal(api.getAccessToken(), 'test-token');
  assert.equal(api.getRefreshToken(), null);
  checks++;
  assert.equal((await api.getProfile()).fullName, 'Test Customer'); checks++;
  const cinemas = await api.getCinemas();
  assert.equal(cinemas.find(c => c.id === 1).rooms[0].id, 2); checks++;
  assert.equal((await api.getCinemaById(1)).name, 'Test Cinema'); checks++;
  assert.equal((await api.getRoomsByCinema(1))[0].id, 2); checks++;
  const seat = (await api.getSeatsByRoom(2))[0];
  assert.equal(seat.seatNumber, 'A1');
  assert.equal(seat.priceMultiplier, 1.5);
  assert.equal(seat.roomId, 2); checks++;
  api.clearTokens();
  assert.equal(api.getCurrentUser(), null);
  assert.equal(api.getAccessToken(), null); checks++;
  assert.equal('updateProfile' in api, false); checks++;
  console.log(`API contract checks: ${checks} passed`);
  if (process.argv.includes('--live')) {
    globalThis.fetch = realFetch;
    await api.login(process.env.FE_TEST_EMAIL || 'customer@gmail.com', process.env.FE_TEST_PASSWORD || 'Admin@123');
    const profile = await api.getProfile();
    assert.equal(typeof profile.email, 'string');
    assert.equal(typeof profile.fullName, 'string');
    const cinemas = await api.getCinemas();
    assert.ok(Array.isArray(cinemas));
    const room = cinemas.flatMap(c => c.rooms ?? []).find(r => r.totalSeats > 0);
    assert.ok(room, 'Need a room with seats for integration test');
    const seats = await api.getSeatsByRoom(room.id);
    assert.ok(seats.length > 0);
    assert.ok(seats.every(s => typeof s.seatNumber === 'string' && Number.isFinite(s.priceMultiplier)));
    console.log('Live backend checks: login, profile, cinemas and seat labels/prices passed');
  }
} finally {
  api.clearTokens();
  globalThis.fetch = realFetch;
  delete globalThis.localStorage;
  delete globalThis.window;
}
