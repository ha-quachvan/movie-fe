const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const AUTH = `${API_BASE}/api/auth`;

const ACCESS_KEY = "accessToken";
const REFRESH_KEY = "refreshToken";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(access: string, refresh?: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACCESS_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  else localStorage.removeItem(REFRESH_KEY);
  window.dispatchEvent(new Event("auth-change"));
}

export function clearTokens() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem("user");
  window.dispatchEvent(new Event("auth-change"));
}

// Bổ sung helper lấy User Profile và kiểm tra Admin
export function getCurrentUser(): { id?: number; email?: string; role?: string; [key: string]: unknown } | null {
  if (typeof window === "undefined") return null;
  const userStr = localStorage.getItem("user");
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export function isAdmin(): boolean {
  const user = getCurrentUser();
  return user?.role === "ADMIN" || user?.role === "admin";
}

class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, data: unknown) {
    super(`API error ${status}`);
    this.status = status;
    this.data = data;
  }
}

let refreshPromise: Promise<string> | null = null;

export async function refreshAccessToken(): Promise<string> {
  const refresh = getRefreshToken();
  if (!refresh) throw new ApiError(401, { detail: "Thiếu refresh token" });

  if (!refreshPromise) {
    refreshPromise = (async () => {
      const res = await fetch(`${AUTH}/refresh-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      if (!res.ok) {
        clearTokens();
        throw new ApiError(res.status, await res.json().catch(() => null));
      }
      const data = await res.json();
      const newAccess = data.accessToken || data.access;
      const newRefresh = data.refreshToken || data.refresh;
      setTokens(newAccess, newRefresh);
      return newAccess as string;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
  retryOn401 = true
): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let cleanPath = path.replace(/^\/+|\/+$/g, "");
  cleanPath = cleanPath.replace(/^api\/v1\//, "").replace(/^api\//, "");
  
  const url = `${API_BASE}/api/${cleanPath}`;

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401 && retryOn401 && getRefreshToken()) {
    try {
      await refreshAccessToken();
      return apiFetch<T>(path, options, false);
    } catch {
    }
  }

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

export interface LoginResponse {
  accessToken?: string;
  access?: string;
  refresh?: string;
  user?: unknown;
  data?: LoginResponse;
  result?: LoginResponse;
  refreshToken?: string;
  [key: string]: unknown;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${AUTH}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));

  const data: LoginResponse = await res.json();

  const token =
    data.accessToken ||
    data.access ||
    data.data?.accessToken ||
    data.result?.accessToken;

  const refresh =
    data.refreshToken ||
    data.refresh ||
    data.data?.refreshToken;

  const user = data.user || data.data?.user;

  if (token) {
    setTokens(token, refresh);
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
      window.dispatchEvent(new Event("auth-change"));
    }
  } else {
    throw new ApiError(500, { message: "Không tìm thấy token trong phản hồi từ server!" });
  }

  return data;
}

async function authPost<T = unknown>(
  path: string,
  body: Record<string, unknown>,
  method: "POST" | "PUT" = "POST"
): Promise<T> {
  const cleanPath = path.replace(/\/+$/, "");
  const res = await fetch(`${AUTH}/${cleanPath}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : await res.text();
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

export async function register(
  email: string,
  fullName: string,
  password: string,
  phoneNumber?: string
): Promise<{ message?: string }> {
  return authPost("register", { email, fullName, password, phoneNumber });
}

export async function verifyEmail(
  email: string,
  otp: string
): Promise<{ message?: string }> {
  return authPost("verify-email", { email, otp });
}

export async function requestPasswordReset(
  email: string
): Promise<{ message?: string }> {
  return authPost("resend-otp", { email });
}

export async function resetPassword(
  email: string,
  otp: string,
  newPassword: string
): Promise<LoginResponse> {
  const data = await authPost<LoginResponse>(
    "reset-password",
    { email, otp, new_password: newPassword },
    "PUT"
  );
  const token = data.accessToken || data.access;
  if (token) setTokens(token, data.refresh);
  return data;
}

export interface Profile {
  id: number;
  email: string;
  full_name?: string;
  fullName?: string;
  phone_number?: string | null;
  phoneNumber?: string | null;
  profile_picture?: string | null;
  is_verified?: boolean;
  level?: number;
  xp?: number;
  current_streak?: number;
  longest_streak?: number;
  created_at?: string;
  createdAt?: string;
  role?: string;
  status?: string;
}

export async function getProfile(): Promise<Profile> {
  const response = await apiFetch<{ data: Profile }>("users/me");
  return unwrapData<Profile>(response);
}

export async function logout() {
  clearTokens();
  if (typeof window !== "undefined") {
    localStorage.removeItem("user");
  }
}

export interface StudySession {
  id?: number | string;
  started_at?: string;
  ended_at?: string | null;
  duration_seconds?: number;
  [key: string]: unknown;
}

export function startSession(): Promise<StudySession> {
  return apiFetch<StudySession>("sessions/start", { method: "POST" });
}

export function endSession(): Promise<StudySession> {
  return apiFetch<StudySession>("sessions/end", { method: "POST" });
}

export function readApiError(err: unknown, fallback = "Có lỗi xảy ra, thử lại sau."): string {
  if (err instanceof ApiError) {
    const data = err.data;
    if (typeof data === "string" && data) return data;
    if (data && typeof data === "object") {
      const obj = data as Record<string, unknown>;
      const first =
        obj.message ??
        obj.detail ??
        obj.non_field_errors ??
        Object.values(obj)[0];
      if (Array.isArray(first)) return String(first[0]);
      if (first) return String(first);
    }
    if (err.status === 401) return "Email hoặc mật khẩu không đúng.";
    return `Yêu cầu thất bại (mã ${err.status}).`;
  }
  return err instanceof Error ? err.message : fallback;
}

export { ApiError, API_BASE };

// ==========================================
// 🎬 API & KIỂU DỮ LIỆU PHIM (UC1 MOVIES)
// ==========================================

export type MovieStatusEnum = 'NOW_SHOWING' | 'COMING_SOON' | 'ENDED';

export interface Genre {
  id: number;
  name: string;
}

export interface Movie {
  id: number;
  title: string;
  description?: string | null;
  durationMinutes: number;
  releaseDate?: string | null;
  genres?: Genre[];
  ageRating?: string | null;
  director?: string | null;
  cast?: string | null;
  posterUrl?: string | null;
  trailerUrl?: string | null;
  status: MovieStatusEnum;
  rating: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateMoviePayload {
  title: string;
  description?: string;
  durationMinutes: number;
  releaseDate: string;
  genreIds?: number[];
  ageRating?: string;
  director?: string;
  cast?: string;
  posterUrl?: string;
  trailerUrl?: string;
  status?: MovieStatusEnum;
  rating?: number;
}

export type UpdateMoviePayload = Partial<CreateMoviePayload>;

export async function getMovies(): Promise<Movie[]> {
  const res = await apiFetch<{ message: string; data: Movie[] }>("movies");
  return res.data ?? [];
}

export async function getMovieById(id: number): Promise<Movie> {
  const res = await apiFetch<{ message: string; data: Movie }>(`movies/${id}`);
  return res.data;
}

export async function createMovie(payload: CreateMoviePayload): Promise<Movie> {
  const res = await apiFetch<{ message: string; data: Movie }>("movies", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateMovie(id: number, payload: UpdateMoviePayload): Promise<Movie> {
  const res = await apiFetch<{ message: string; data: Movie }>(`movies/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function deleteMovie(id: number): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`movies/${id}`, {
    method: "DELETE",
  });
}

// ==========================================
// UC2: TYPES & API CHO QUẢN LÝ RẠP & PHÒNG CHIẾU
// ==========================================

export interface Room {
  id: number;
  name: string;
  totalSeats: number;
  cinemaId: number;
  capacity?: number; // Giữ dạng optional để tương thích ngược nếu cần
  status?: string;
}

export interface Cinema {
  id: number;
  name: string;
  address: string;
  city: string; // "Hà Nội", "TP. Hồ Chí Minh", "Đà Nẵng"...
  phone?: string;
  status?: string;
  rooms?: Room[];
  _count?: {
    rooms?: number;
  };
}

export interface CreateCinemaPayload {
  name: string;
  address: string;
  city: string;
  phone?: string;
  status?: string;
}

export type UpdateCinemaPayload = Partial<CreateCinemaPayload>;

// Interface cấu hình phân loại ghế (Thường, VIP, Sweetbox...)
export interface SeatConfig {
  seatTypeId: number;
  totalSeats: number;
}

export interface CreateRoomPayload {
  name: string;
  totalSeats: number;
  cinemaId: number;
  seatConfigurations?: SeatConfig[]; // Tùy chọn truyền danh sách phân loại ghế
  status?: string;
}

export type UpdateRoomPayload = Partial<Omit<CreateRoomPayload, "cinemaId">>;

// --- API QUẢN LÝ RẠP CHIẾU (CINEMAS) ---

export async function getCinemas(): Promise<Cinema[]> {
  const result = unwrapData<Cinema[]>(await apiFetch("/cinemas"));
  return Array.isArray(result) ? result : [];
}

export async function getCinemaById(id: number): Promise<Cinema> {
  return unwrapData<Cinema>(await apiFetch(`/cinemas/${id}`));
}

export async function createCinema(payload: CreateCinemaPayload): Promise<Cinema> {
  return unwrapData<Cinema>(await apiFetch("/cinemas", {
    method: "POST",
    body: JSON.stringify(payload),
  }));
}

export async function updateCinema(id: number, payload: UpdateCinemaPayload): Promise<Cinema> {
  return unwrapData<Cinema>(await apiFetch(`/cinemas/${id}`, {
    method: "PUT", // Đồng bộ dùng PUT với CinemasController
    body: JSON.stringify(payload),
  }));
}

export async function deleteCinema(id: number): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/cinemas/${id}`, {
    method: "DELETE",
  });
}

// --- API QUẢN LÝ PHÒNG CHIẾU (ROOMS) ---

export async function getRoomsByCinema(cinemaId: number): Promise<Room[]> {
  const result = unwrapData<Room[]>(await apiFetch(`/cinemas/${cinemaId}/rooms`));
  return Array.isArray(result) ? result : [];
}

export async function createRoom(payload: CreateRoomPayload): Promise<Room> {
  const sanitizedPayload: CreateRoomPayload = {
    name: payload.name,
    totalSeats: Number(payload.totalSeats),
    cinemaId: Number(payload.cinemaId),
    ...(payload.seatConfigurations && payload.seatConfigurations.length > 0
      ? {
          seatConfigurations: payload.seatConfigurations.map((item) => ({
            seatTypeId: Number(item.seatTypeId),
            totalSeats: Number(item.totalSeats),
          })),
        }
      : {}),
    ...(payload.status ? { status: payload.status } : {}),
  };

  return unwrapData<Room>(await apiFetch("/cinemas/rooms", {
    method: "POST",
    body: JSON.stringify(sanitizedPayload),
  }));
}

export async function updateRoom(id: number, payload: UpdateRoomPayload): Promise<Room> {
  const sanitizedPayload = {
    ...payload,
    ...(payload.totalSeats !== undefined ? { totalSeats: Number(payload.totalSeats) } : {}),
  };

  return unwrapData<Room>(await apiFetch(`/cinemas/rooms/${id}`, {
    method: "PUT",
    body: JSON.stringify(sanitizedPayload),
  }));
}

export async function deleteRoom(id: number): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/cinemas/rooms/${id}`, {
    method: "DELETE",
  });
}

// ==========================================
// 💺 UC3: TYPES & API CHO QUẢN LÝ GHẾ & SƠ ĐỒ PHÒNG CHIẾU (ĐẶNG MINH QUANG)
// ==========================================

export type SeatType = "REGULAR" | "VIP" | "COUPLE";
export type SeatStatus = "AVAILABLE" | "HOLDING" | "BOOKED" | "INACTIVE";

export interface Seat {
  id: number;
  roomId: number;
  row: string;
  column: number;
  seatNumber: string;
  type: SeatType;
  priceMultiplier: number;
  status: SeatStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface GenerateSeatsGridPayload {
  roomId: number;
  rows: string[];
  colsPerRow: number;
  vipRows?: string[];
}

export interface CreateSeatPayload {
  roomId: number;
  row: string;
  column: number;
  seatNumber: string;
  type: SeatType;
  priceMultiplier?: number;
}

function unwrapData<T>(res: unknown): T {
  if (res && typeof res === "object" && "data" in res) {
    return (res as { data: T }).data;
  }
  return res as T;
}

export async function getSeatsByRoom(roomId: number): Promise<Seat[]> {
  const res = await apiFetch<{ data: Seat[] } | Seat[]>(`seats/room/${roomId}`);
  const result = unwrapData<(Seat & { label?: string; priceCoefficient?: number })[]>(res);
  return Array.isArray(result) ? result.map(seat => ({ ...seat, roomId,
    seatNumber: seat.seatNumber ?? seat.label ?? `${seat.row}${seat.column}`,
    priceMultiplier: Number(seat.priceMultiplier ?? seat.priceCoefficient ?? 1),
  })) : [];
}

export async function generateSeatsGrid(
  payload: GenerateSeatsGridPayload
): Promise<{ created: number; skipped?: number; message?: string }> {
  const res = await apiFetch<{ data: { created: number; skipped?: number; message?: string } } | { created: number; skipped?: number; message?: string }>("seats/generate-grid", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return unwrapData<{ created: number; skipped?: number; message?: string }>(res);
}

export async function createSeat(payload: CreateSeatPayload): Promise<Seat> {
  const res = await apiFetch<{ data: Seat } | Seat>("seats", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return unwrapData<Seat>(res);
}

export async function deleteSeat(id: number): Promise<{ message?: string; success?: boolean }> {
  return apiFetch(`seats/${id}`, { method: "DELETE" });
}

// ==========================================
// 📅 UC4: TYPES & API CHO QUẢN LÝ SUẤT CHIẾU & XUNG ĐỘT (ĐẶNG MINH QUANG)
// ==========================================

export type ShowtimeStatus = "SCHEDULED" | "CANCELLED" | "COMPLETED";

export interface Showtime {
  id: number;
  movieId: number;
  roomId: number;
  startTime: string;
  endTime: string;
  basePrice: number;
  cleanupMinutes: number;
  status: ShowtimeStatus;
  movie?: Movie;
  room?: Room & { cinema?: Cinema };
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateShowtimePayload {
  movieId: number;
  roomId: number;
  startTime: string;
  endTime: string;
  basePrice: number;
  cleanupMinutes?: number;
}

export type UpdateShowtimePayload = Partial<CreateShowtimePayload>;

export interface CheckConflictPayload {
  roomId: number;
  startTime: string;
  endTime: string;
  cleanupMinutes?: number;
  excludeShowtimeId?: number;
}

export interface ConflictItem {
  id: number;
  movieTitle: string;
  startTime: string;
  endTime: string;
}

export interface CheckConflictResponse {
  hasConflict: boolean;
  conflicts?: ConflictItem[];
  message?: string;
}

export interface QueryShowtimeParams {
  movieId?: number;
  roomId?: number;
  cinemaId?: number;
  date?: string;
  status?: ShowtimeStatus;
}

export async function getShowtimes(params?: QueryShowtimeParams): Promise<Showtime[]> {
  const search = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") {
        search.append(k, String(v));
      }
    });
  }
  const queryString = search.toString() ? `?${search.toString()}` : "";
  const res = await apiFetch<{ data: Showtime[] } | Showtime[]>(`showtimes${queryString}`);
  const result = unwrapData<Showtime[]>(res);
  return Array.isArray(result) ? result : [];
}

export async function getShowtimeById(id: number): Promise<Showtime> {
  const res = await apiFetch<{ data: Showtime } | Showtime>(`showtimes/${id}`);
  return unwrapData<Showtime>(res);
}

export async function checkShowtimeConflict(
  payload: CheckConflictPayload
): Promise<CheckConflictResponse> {
  const res = await apiFetch<{ data: CheckConflictResponse } | CheckConflictResponse>(
    "showtimes/check-conflict",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
  return unwrapData<CheckConflictResponse>(res);
}

export async function createShowtime(payload: CreateShowtimePayload): Promise<Showtime> {
  const res = await apiFetch<{ data: Showtime } | Showtime>("showtimes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return unwrapData<Showtime>(res);
}

export async function updateShowtime(
  id: number,
  payload: UpdateShowtimePayload
): Promise<Showtime> {
  const res = await apiFetch<{ data: Showtime } | Showtime>(`showtimes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return unwrapData<Showtime>(res);
}

export async function cancelShowtime(id: number): Promise<{ message?: string; success?: boolean }> {
  return apiFetch(`showtimes/${id}`, { method: "DELETE" });
}

// ==========================================
// 🎟️ UC9: TYPES & API CHO QUẢN LÝ VÉ & HOÀN HỦY (MAI ANH TUẤN)
// ==========================================

export type TicketStatus = "PENDING" | "VALID" | "USED" | "CANCELLED" | "EXPIRED" | "REFUNDED";
export type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "EXPIRED";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";

export interface BookingSeat {
  id: number;
  seatNumber: string;
  row?: string;
  column?: number;
  type?: string;
}

export interface BookingTicket {
  id: number;
  ticketCode: string;
  price: number | string;
  status: TicketStatus | string;
  seatId?: number;
  seat?: BookingSeat;
}

export interface BookingPayment {
  id: number;
  bookingId: number;
  method: string;
  amount: number | string;
  status: PaymentStatus | string;
  currency: string;
  transactionCode?: string | null;
  refundId?: string | null;
  refundAmount?: number | string;
  paidAt?: string | null;
  refundedAt?: string | null;
}

export interface BookingDetail {
  id: number;
  bookingCode: string;
  userId: number;
  showtimeId: number;
  voucherId?: number | null;
  totalAmount: number | string;
  discountAmount: number | string;
  status: BookingStatus | string;
  holdExpiresAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  createdAt: string;
  updatedAt: string;
  tickets?: BookingTicket[];
  payments?: BookingPayment[];
  showtime?: {
    id: number;
    startTime: string;
    endTime: string;
    basePrice: number | string;
    status?: string;
    movie?: {
      id: number;
      title: string;
      posterUrl?: string | null;
      durationMinutes?: number;
      ageRating?: string | null;
      director?: string | null;
    };
    room?: {
      id: number;
      roomName: string;
      type?: string;
      totalSeats?: number;
      cinema?: {
        id: number;
        name: string;
        address?: string | null;
        city?: string | null;
      };
    };
  };
}

export interface CancelTicketResponse {
  bookingCode: string;
  status: string;
  mode?: string;
  message?: string;
}

export async function getMyBookings(): Promise<BookingDetail[]> {
  const res = await apiFetch<{ data: BookingDetail[] } | BookingDetail[]>("tickets/my-history");
  const result = unwrapData<BookingDetail[]>(res);
  return Array.isArray(result) ? result : [];
}

export async function getBookingDetail(bookingCode: string): Promise<BookingDetail> {
  const res = await apiFetch<{ data: BookingDetail } | BookingDetail>(`tickets/${bookingCode}`);
  return unwrapData<BookingDetail>(res);
}

export async function cancelAndRefundTicket(bookingCode: string): Promise<CancelTicketResponse> {
  const res = await apiFetch<{ data: CancelTicketResponse } | CancelTicketResponse>(
    `tickets/${bookingCode}/cancel`,
    {
      method: "POST",
    }
  );
  return unwrapData<CancelTicketResponse>(res);
}

export async function mockPayBooking(bookingCode: string): Promise<any> {
  const res = await apiFetch<any>("bookings/pay-mock", {
    method: "POST",
    body: JSON.stringify({ bookingCode, stripeToken: "tok_visa" }),
  });
  return unwrapData(res);
}

// ==========================================
// 📊 UC10: TYPES & API CHO THỐNG KÊ DOANH THU & QUERY PROCESSING (MAI ANH TUẤN)
// ==========================================

export interface OverviewSummary {
  totalRevenue: number;
  totalTicketsSold: number;
  successfulBookings: number;
  cancelledBookings: number;
  cancellationRate: string;
}

export interface TopMovieRevenue {
  movieId: number;
  title: string;
  totalTickets: number;
  totalRevenue: number;
}

export interface MonthlyRevenue {
  month: string;
  bookingCount: number;
  revenue: number;
}

export interface SeatOccupancy {
  showtimeId: number;
  movieTitle: string;
  roomName: string;
  startTime: string;
  bookedSeats: number;
  totalRoomSeats: number;
  occupancyRate: string;
}

export interface ExplainQueryPlanItem {
  id?: number;
  select_type?: string;
  table?: string;
  partitions?: string | null;
  type?: string;
  possible_keys?: string | null;
  key?: string | null;
  key_len?: string | null;
  ref?: string | null;
  rows?: number;
  filtered?: number | string;
  Extra?: string;
  [key: string]: unknown;
}

export interface ExplainQueryResponse {
  query: string;
  executionTimeMs: string;
  executionPlan: ExplainQueryPlanItem[];
}

export interface BenchmarkResponse {
  benchmarkOverview: string;
  iterations: number;
  pointLookupTest: {
    operation: string;
    redis: {
      totalTimeMs: string;
      avgTimePerOpMs: string;
      throughputOpsSec: number;
      complexity: string;
    };
    mysql: {
      totalTimeMs: string;
      avgTimePerOpMs: string;
      throughputOpsSec: number;
      complexity: string;
    };
    speedupFactor: string;
    winner: string;
    analysis: string;
  };
  complexAnalyticsTest: {
    operation: string;
    mysql: {
      supported: boolean;
      executionTimeMs: string;
      method: string;
      suitability: string;
    };
    redis: {
      supported: boolean;
      method: string;
      suitability: string;
    };
    winner: string;
    analysis: string;
  };
  architectureConclusion: string;
}

export async function getStatisticsSummary(): Promise<OverviewSummary> {
  const res = await apiFetch<{ data: OverviewSummary } | OverviewSummary>("statistics/summary");
  return unwrapData<OverviewSummary>(res);
}

export async function getTopMoviesRevenue(limit: number = 10): Promise<TopMovieRevenue[]> {
  const res = await apiFetch<{ data: TopMovieRevenue[] } | TopMovieRevenue[]>(
    `statistics/top-movies?limit=${limit}`
  );
  const result = unwrapData<TopMovieRevenue[]>(res);
  return Array.isArray(result) ? result : [];
}

export async function getMonthlyRevenue(): Promise<MonthlyRevenue[]> {
  const res = await apiFetch<{ data: MonthlyRevenue[] } | MonthlyRevenue[]>("statistics/monthly-revenue");
  const result = unwrapData<MonthlyRevenue[]>(res);
  return Array.isArray(result) ? result : [];
}

export async function getSeatOccupancy(): Promise<SeatOccupancy[]> {
  const res = await apiFetch<{ data: SeatOccupancy[] } | SeatOccupancy[]>("statistics/seat-occupancy");
  const result = unwrapData<SeatOccupancy[]>(res);
  return Array.isArray(result) ? result : [];
}

export async function explainQuery(query: string): Promise<ExplainQueryResponse> {
  const res = await apiFetch<{ data: ExplainQueryResponse } | ExplainQueryResponse>(
    "statistics/explain",
    {
      method: "POST",
      body: JSON.stringify({ query }),
    }
  );
  return unwrapData<ExplainQueryResponse>(res);
}

export async function runBenchmark(iterations: number = 100): Promise<BenchmarkResponse> {
  const res = await apiFetch<{ data: BenchmarkResponse } | BenchmarkResponse>(
    `statistics/benchmark/mysql-vs-redis?iterations=${iterations}`
  );
  return unwrapData<BenchmarkResponse>(res);
}