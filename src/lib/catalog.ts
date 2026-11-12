import type { Cinema, Movie as ApiMovie, Showtime as ApiShowtime } from './api';

/** Display models only. Every ID and schedule comes from the backend. */
export interface Movie {
  id: string;
  title: string;
  originalTitle?: string;
  posterUrl: string;
  backdropUrl: string;
  trailerYoutubeId: string;
  genres: string[];
  durationMinutes: number;
  rating: number;
  ageRating: string;
  ageLabel: string;
  formats: string[];
  status: 'now_showing' | 'coming_soon';
  releaseDate: string;
  director: string;
  cast: string[];
  synopsis: string;
  isHot?: boolean;
}

export interface Showtime {
  id: string;
  startTime: string;
  time: string;
  format: string;
  room: string;
  price: number;
}

export interface Theater {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  roomsCount: number;
  schedules: { movieId: string; showtimes: Showtime[] }[];
}

export const vietnamDay = (value: string | Date = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date(value));

export function homeMovies(movies: ApiMovie[]): Movie[] {
  return movies.filter(m => m.status !== 'ENDED').map(m => ({
    id: String(m.id), title: m.title, posterUrl: m.posterUrl || '/poster-placeholder.svg',
    backdropUrl: m.posterUrl || '/poster-placeholder.svg',
    trailerYoutubeId: m.trailerUrl?.match(/(?:youtu\.be\/|[?&]v=|embed\/)([\w-]{11})/)?.[1] || '',
    genres: m.genres?.map(g => g.name) || [], durationMinutes: m.durationMinutes,
    rating: Number(m.rating) || 0, ageRating: m.ageRating || 'P', ageLabel: m.ageRating || 'P',
    formats: [], status: m.status === 'COMING_SOON' ? 'coming_soon' : 'now_showing',
    releaseDate: m.releaseDate ? new Date(m.releaseDate).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '',
    director: m.director || '', cast: m.cast?.split(',').map(x => x.trim()) || [], synopsis: m.description || '',
    isHot: Number(m.rating) >= 8,
  }));
}

export function homeTheaters(cinemas: Cinema[], showtimes: ApiShowtime[]): Theater[] {
  const future = showtimes.filter(s => s.status === 'SCHEDULED' && new Date(s.startTime).getTime() > Date.now());
  return cinemas.filter(c => c.status !== 'INACTIVE').map(c => ({
    id: String(c.id), name: c.name, address: c.address, city: c.city, phone: c.phone || 'Chưa cập nhật',
    roomsCount: c.rooms?.length || 0,
    schedules: [...new Set(future.filter(s => s.room?.cinema?.id === c.id).map(s => s.movieId))].map(movieId => ({
      movieId: String(movieId),
      showtimes: future.filter(s => s.movieId === movieId && s.room?.cinema?.id === c.id).map(s => ({
        id: String(s.id), startTime: s.startTime,
        time: new Date(s.startTime).toLocaleTimeString('vi-VN', {timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit'}),
        format: 'Suất chiếu', room: s.room?.name || '', price: Number(s.basePrice),
      })),
    })),
  }));
}
