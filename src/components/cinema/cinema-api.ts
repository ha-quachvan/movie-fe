import { getAccessToken, clearTokens, API_BASE, type Movie } from "@/lib/api";

const CINEMA_API = `${API_BASE}/api`;

export type CinemaShowtime = {
  id: string | number; 
  startTime: string; 
  endTime?: string; 
  basePrice: number | string;
  room?: { id?: string | number; name?: string; cinema?: { id?: string | number; name?: string } };
};

export type CinemaMovie = {
  id: string | number; 
  title: string; 
  description?: string; 
  posterUrl?: string;
  durationMinutes?: number; 
  rating?: number; 
  ageRating?: string; 
  status?: string;
  releaseDate?: string; // 👈 Đã thêm ngày khởi chiếu
  director?: string;    // 👈 Đã thêm Đạo diễn
  cast?: string;        // 👈 Đã thêm Dàn diễn viên
  trailerUrl?: string;  // 👈 Đã thêm Trailer URL
  genres?: { id?: string | number; name: string }[]; 
  showtimes?: CinemaShowtime[];
};

export type CinemaSeat = {
  id: number; 
  row: string; 
  column: number; 
  seatNumber: string; 
  type: string;
  priceMultiplier: number; 
  status: "AVAILABLE" | "HOLDING" | "BOOKED" | "INACTIVE";
  isHeldByMe: boolean; 
  canRelease: boolean; 
  remainingTtl: number;
};

export type Screening = CinemaShowtime & { movie?: CinemaMovie };
export type Filters = { keyword: string; genre: string; cinemaId: string; date: string; minPrice: string; maxPrice: string };
export const emptyFilters: Filters = { keyword: "", genre: "", cinemaId: "", date: "", minPrice: "", maxPrice: "" };

export async function cinemaRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body) headers.set("Content-Type", "application/json");
  const timeout = AbortSignal.timeout(10000);
  const response = await fetch(`${CINEMA_API}${path}`, { 
    ...options, 
    headers, 
    cache: "no-store", 
    signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout 
  });
  const body = await response.json().catch(() => null);
  if (response.status === 401) clearTokens();
  if (!response.ok || body?.success === false) {
    const message = response.status === 401 ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." : body?.message;
    throw new Error(Array.isArray(message) ? message.join(". ") : message || "Chưa kết nối được dữ liệu rạp phim. Vui lòng thử lại.");
  }
  return (body?.data ?? body) as T;
}

export function normalizeMovie(movie: Movie): CinemaMovie {
  return { ...movie, rating: Number(movie.rating), description: movie.description ?? undefined,
    posterUrl: movie.posterUrl || "/poster-placeholder.svg", ageRating: movie.ageRating ?? undefined,
    releaseDate: movie.releaseDate ?? undefined, director: movie.director ?? undefined,
    cast: movie.cast ?? undefined, trailerUrl: movie.trailerUrl ?? undefined };
}

export const price = (value: number | string) => `${Number(value).toLocaleString("vi-VN")}đ`;
export const dateLabel = (value: string) => new Date(value).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit" });
export const timeLabel = (value: string) => new Date(value).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" });
export const countdown = (value: number) => `${Math.floor(Math.max(0, value) / 60).toString().padStart(2, "0")}:${(Math.max(0, value) % 60).toString().padStart(2, "0")}`;
