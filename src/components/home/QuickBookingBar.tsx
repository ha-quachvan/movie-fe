"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Movie, Theater, vietnamDay } from "@/lib/catalog";

interface QuickBookingBarProps {
  movies: Movie[];
  theaters: Theater[];
}

export default function QuickBookingBar({ movies, theaters }: QuickBookingBarProps) {
  const router = useRouter();

  const nowShowingMovies = useMemo(
    () => movies.filter((m) => m.status === "now_showing"),
    [movies]
  );

  const [selectedMovieId, setSelectedMovieId] = useState<string>("");
  const [selectedTheaterId, setSelectedTheaterId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(() => vietnamDay());
  const [selectedShowtimeId, setSelectedShowtimeId] = useState<string>("");
  const [calendarStart] = useState(() => Date.now());

  // Dates options (Today, Tomorrow, Day after)
  const dateOptions = useMemo(() => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(calendarStart + i * 86400000);
      const id = vietnamDay(date);
      dates.push({ id, label: `${i === 0 ? "Hôm nay" : i === 1 ? "Ngày mai" : "Ngày chiếu"} (${id.slice(8)}/${id.slice(5, 7)})` });
    }
    return dates;
  }, [calendarStart]);

  // Filter available theaters for selected movie
  const availableTheaters = useMemo(() => {
    if (!selectedMovieId) return theaters;
    return theaters.filter((t) =>
      t.schedules.some((s) => s.movieId === selectedMovieId)
    );
  }, [theaters, selectedMovieId]);

  // Available showtimes for selected theater & movie
  const availableShowtimes = useMemo(() => {
    if (!selectedMovieId || !selectedTheaterId) return [];
    const theater = theaters.find((t) => t.id === selectedTheaterId);
    if (!theater) return [];
    const schedule = theater.schedules.find((s) => s.movieId === selectedMovieId);
    return schedule ? schedule.showtimes.filter(st => vietnamDay(st.startTime) === selectedDate) : [];
  }, [theaters, selectedMovieId, selectedTheaterId, selectedDate]);

  const handleMovieChange = (movieId: string) => {
    setSelectedMovieId(movieId);
    setSelectedShowtimeId("");
    // If current theater doesn't have this movie, auto-select first available theater
    if (selectedTheaterId) {
      const currentTheater = theaters.find((t) => t.id === selectedTheaterId);
      const hasMovie = currentTheater?.schedules.some((s) => s.movieId === movieId);
      if (!hasMovie) {
        const nextTheater = theaters.find((t) =>
          t.schedules.some((s) => s.movieId === movieId)
        );
        setSelectedTheaterId(nextTheater ? nextTheater.id : "");
      }
    }
  };

  const handleTheaterChange = (theaterId: string) => {
    setSelectedTheaterId(theaterId);
    setSelectedShowtimeId("");
  };

  const handleBooking = () => {
    if (!selectedMovieId || !availableShowtimes.some(st => st.id === selectedShowtimeId)) return;
    router.push(
      `/booking/seats?movieId=${selectedMovieId}&theaterId=${selectedTheaterId}&showtimeId=${selectedShowtimeId}&date=${selectedDate}`
    );
  };

  return (
    <section id="booking" className="relative z-30 -mt-10 sm:-mt-12 mx-auto max-w-6xl px-4 sm:px-6">
      <div className="rounded-2xl border border-white/10 bg-neutral-900/90 p-4 sm:p-5 shadow-2xl backdrop-blur-xl ring-1 ring-white/10">
        <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-red-500 animate-ping" />
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
              Đặt Vé Nhanh
            </h2>
          </div>
          <span className="text-[11px] text-neutral-400 hidden sm:inline">
            Chọn phim & rạp để xem các suất chiếu còn chỗ
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end">
          {/* Step 1: Chọn Phim */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block mb-1">
              1. Chọn Phim
            </label>
            <select
              value={selectedMovieId}
              onChange={(e) => handleMovieChange(e.target.value)}
              className="w-full rounded-xl border border-neutral-700/80 bg-neutral-800/90 px-3 py-2.5 text-xs sm:text-sm text-white font-medium focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors"
            >
              <option value="">-- Chọn Phim Đang Chiếu --</option>
              {nowShowingMovies.map((movie) => (
                <option key={movie.id} value={movie.id}>
                  {movie.title}
                </option>
              ))}
            </select>
          </div>

          {/* Step 2: Chọn Rạp */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block mb-1">
              2. Chọn Rạp
            </label>
            <select
              value={selectedTheaterId}
              onChange={(e) => handleTheaterChange(e.target.value)}
              disabled={!selectedMovieId}
              className="w-full rounded-xl border border-neutral-700/80 bg-neutral-800/90 px-3 py-2.5 text-xs sm:text-sm text-white font-medium focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">-- Chọn Cụm Rạp --</option>
              {availableTheaters.map((theater) => (
                <option key={theater.id} value={theater.id}>
                  {theater.name}
                </option>
              ))}
            </select>
          </div>

          {/* Step 3: Chọn Ngày */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block mb-1">
              3. Chọn Ngày
            </label>
            <select
              value={selectedDate}
              onChange={(e) => { setSelectedDate(e.target.value); setSelectedShowtimeId(""); }}
              disabled={!selectedMovieId}
              className="w-full rounded-xl border border-neutral-700/80 bg-neutral-800/90 px-3 py-2.5 text-xs sm:text-sm text-white font-medium focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {dateOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          {/* Step 4: Chọn Suất Chiếu */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block mb-1">
              4. Suất Chiếu
            </label>
            <select
              value={selectedShowtimeId}
              onChange={(e) => setSelectedShowtimeId(e.target.value)}
              disabled={!selectedTheaterId || availableShowtimes.length === 0}
              className="w-full rounded-xl border border-neutral-700/80 bg-neutral-800/90 px-3 py-2.5 text-xs sm:text-sm text-white font-medium focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">
                {!selectedTheaterId
                  ? "-- Vui lòng chọn rạp --"
                  : availableShowtimes.length === 0
                  ? "Không có suất chiếu"
                  : "-- Chọn Giờ Chiếu --"}
              </option>
              {availableShowtimes.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.time} · {st.format} ({st.price.toLocaleString("vi-VN")}đ)
                </option>
              ))}
            </select>
          </div>

          {/* CTA Submit Button */}
          <div>
            <button
              type="button"
              onClick={handleBooking}
              disabled={!selectedMovieId || !availableShowtimes.some(st => st.id === selectedShowtimeId)}
              className="w-full rounded-xl bg-gradient-to-r from-red-600 to-rose-600 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-white shadow-lg shadow-red-600/30 transition-all hover:scale-[1.02] hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              Mua Vé Ngay →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
