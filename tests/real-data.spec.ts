import { test, expect, request, type APIRequestContext, type BrowserContext } from '@playwright/test';

const apiRoot = (process.env.E2E_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '').replace(/\/api$/, '') + '/api';
let api: APIRequestContext;
let movie: {id: number; title: string};
let screening: {id: number; movieId: number; basePrice: string | number};
let cinemas: {id: number; name: string}[];

async function signIn(context: BrowserContext, admin = false) {
  // These defaults are explicitly documented local seed accounts, never live credentials.
  const result = await api.post(apiRoot + '/auth/login', {data: {
    email: admin ? process.env.E2E_ADMIN_EMAIL || 'admin@cinema.com' : process.env.E2E_CUSTOMER_EMAIL || 'customer@gmail.com',
    password: admin ? process.env.E2E_ADMIN_PASSWORD || 'Admin@123' : process.env.E2E_CUSTOMER_PASSWORD || 'Admin@123',
  }});
  expect(result.ok(), 'Run backend seed or configure E2E test accounts').toBeTruthy();
  const data = (await result.json()).data;
  await context.addInitScript(({token, user}) => {
    localStorage.setItem('accessToken', token);
    localStorage.setItem('user', JSON.stringify(user));
  }, {token: data.accessToken, user: data.user});
  return {Authorization: `Bearer ${data.accessToken}`};
}

test.beforeAll(async () => {
  api = await request.newContext({baseURL: apiRoot + '/'});
  // Leading '/' paths are resolved against the host by Playwright; keep the API
  // prefix on all request helpers by using the fully qualified URL below.
  const scheduled = await api.get(apiRoot + '/showtimes?status=SCHEDULED');
  expect(scheduled.ok()).toBeTruthy();
  screening = (await scheduled.json()).data.find((s: {startTime: string}) => new Date(s.startTime).getTime() > Date.now());
  expect(screening, 'Run npm run seed in backend to create future showtimes').toBeTruthy();
  const details = await api.get(apiRoot + `/movies/${screening.movieId}`);
  movie = (await details.json()).data;
  cinemas = (await (await api.get(apiRoot + '/cinemas')).json()).data;
});
test.afterAll(async () => { await api?.dispose(); });

test('home reads real movies, cinemas and showtime IDs', async ({page}) => {
  const requests: string[] = [];
  page.on('request', r => { if (r.url().includes('/api/')) requests.push(new URL(r.url()).pathname); });
  await page.goto('/');
  await expect(page.getByRole('heading', {name: movie.title, exact: true}).first()).toBeVisible();
  expect(requests).toEqual(expect.arrayContaining(['/api/movies', '/api/cinemas', '/api/showtimes']));
  const options = await page.locator('#booking select').nth(1).locator('option').allTextContents();
  expect(options).toContain(cinemas[0].name);
  await expect(page.locator('a[href*="showtimeId=st-"],a[href*="movieId=m-"],a[href*="demo=1"]')).toHaveCount(0);
});

test('catalog date/price filters really reach the backend', async ({page}) => {
  await page.goto('/movies');
  await expect(page.getByRole('link', {name: movie.title, exact: true}).first()).toBeVisible();
  await page.getByLabel('Giá tối đa').fill('1000');
  const priceResult = page.waitForResponse(r => r.url().includes('/api/search/movies?') && r.url().includes('maxPrice=1000'));
  await page.getByRole('button', {name: 'Áp dụng bộ lọc →'}).click();
  expect((await priceResult).ok()).toBeTruthy();
  await expect(page.getByRole('heading', {name: 'Chưa tìm thấy phim phù hợp'})).toBeVisible();
  await page.getByRole('button', {name: 'Đặt lại', exact: true}).click();
  await expect(page.getByRole('link', {name: movie.title, exact: true}).first()).toBeVisible();
  await page.getByLabel('Ngày chiếu').fill('2000-01-01');
  await page.getByRole('button', {name: 'Áp dụng bộ lọc →'}).click();
  await expect(page.getByRole('heading', {name: 'Chưa tìm thấy phim phù hợp'})).toBeVisible();
});

test('movie details link to the same real screening and real seat map', async ({page}) => {
  await page.goto(`/movies/${movie.id}`);
  await expect(page.getByRole('heading', {name: movie.title, exact: true})).toBeVisible();
  const link = page.locator(`a[href$="showtimeId=${screening.id}"]`).first();
  await expect(link).toBeVisible();
  expect(await link.getAttribute('href')).not.toContain('demo=1');
  await link.click();
  const matrix = (await (await api.get(apiRoot + `/seats/matrix/showtime/${screening.id}`)).json()).data;
  await expect(page.locator('button[title^="Ghế "]')).toHaveCount(matrix.seats.length);
  await expect(page.getByText('CHẾ ĐỘ XEM THỬ (DEMO)', {exact: true})).toHaveCount(0);
});

test('a signed-in browser holds a real Redis seat and releases it', async ({page, context}) => {
  const headers = await signIn(context);
  let holdToken: string | undefined;
  let selectedId: number | undefined;
  try {
    await page.goto(`/booking/seats?movieId=${movie.id}&showtimeId=${screening.id}`);
    const matrix = (await (await api.get(apiRoot + `/seats/matrix/showtime/${screening.id}`)).json()).data;
    const seat = matrix.seats.find((s: {status: string}) => s.status === 'AVAILABLE');
    expect(seat).toBeTruthy(); selectedId = seat.id;
    const button = page.getByTitle(`Ghế ${seat.seatNumber} (${seat.type})`, {exact: true});
    await expect(button).toBeEnabled();
    const hold = page.waitForResponse(r => r.url().endsWith('/api/bookings/hold-seat') && r.request().method() === 'POST');
    await button.click();
    const response = await hold; expect(response.ok()).toBeTruthy();
    holdToken = (await response.json()).data.holdToken;
    const shared = (await (await api.get(apiRoot + `/seats/matrix/showtime/${screening.id}`)).json()).data.seats.find((s: {id: number}) => s.id === seat.id);
    expect(shared.status).toBe('HOLDING'); expect(shared.isHeldByMe).toBe(false);
    await expect(page.getByTitle('Bỏ chọn')).toHaveCount(1);
    const release = page.waitForResponse(r => r.url().endsWith('/api/bookings/release-seat') && r.request().method() === 'POST');
    await page.getByTitle('Bỏ chọn').click();
    expect((await release).ok()).toBeTruthy();
    holdToken = undefined;
  } finally {
    if (holdToken && selectedId) {
      const release = await api.post(apiRoot + '/bookings/release-seat', {headers, data: {showtimeId: screening.id, seatId: selectedId, holdToken}});
      expect(release.ok()).toBeTruthy();
    }
  }
});

test('demo is explicit, supports its own details, and does not call booking APIs', async ({page}) => {
  const writes: string[] = [];
  page.on('request', r => { if (r.method() === 'POST' && r.url().includes('/api/bookings/')) writes.push(r.url()); });
  await page.goto('/movies?demo=1&keyword=Dune');
  await page.locator('a[href="/movies/m-1?demo=1"]').first().click();
  await expect(page.getByRole('heading', {name: 'Dune: Hành Tinh Cát - Phần 2', exact: true})).toBeVisible();
  await page.locator('a[href*="showtimeId=st-"]').first().click();
  await expect(page.getByText('CHẾ ĐỘ XEM THỬ (DEMO)', {exact: true})).toBeVisible();
  await expect(page.locator('button[title^="Ghế "]')).toHaveCount(96);
  await page.getByTitle('Ghế A1 (REGULAR)', {exact: true}).click();
  await page.getByRole('button', {name: 'Xác nhận đặt vé & Thanh toán (UC8)'}).click();
  await expect(page.getByText(/CF-DEMO-/).first()).toBeVisible();
  await page.getByRole('button', {name: 'Thanh toán qua Stripe Test Mode', exact: true}).click();
  await expect(page.getByText(/Chế độ xem thử không tạo giao dịch Stripe/)).toBeVisible();
  expect(writes).toHaveLength(0);
});

test('profile and administrator daily revenue use protected real APIs', async ({page, context}) => {
  await signIn(context, true);
  await page.goto('/profile');
  await expect(page.getByRole('heading', {name: 'Thông tin cá nhân'})).toBeVisible();
  const daily = page.waitForResponse(r => r.url().includes('/api/statistics/daily-revenue'));
  await page.goto('/admin/statistics');
  expect((await daily).ok()).toBeTruthy();
  await expect(page.getByRole('heading', {name: 'Doanh thu theo ngày (giờ Việt Nam)'})).toBeVisible();
});
