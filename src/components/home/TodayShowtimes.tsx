"use client";

import Image from "next/image";

import { useState } from "react";
import Link from "next/link";
import { Movie, Theater } from "@/lib/mockData";
import MovieSearchInput from "./MovieSearchInput";
import { matchesMovieTitle } from "@/lib/movie-search";

interface TodayShowtimesProps {
  theaters: Theater[];
  movies: Movie[];
  keyword: string;
  onKeywordChange: (keyword: string) => void;
}

export default function TodayShowtimes({ theaters, movies, keyword, onKeywordChange }: TodayShowtimesProps) {
  const [selectedTheaterId, setSelectedTheaterId] = useState<string>(
    theaters[0]?.id || ""
  );

  const currentTheater = theaters.find((t) => t.id === selectedTheaterId) || theaters[0];

  // Resolve movies with their showtimes in this theater
  const scheduledMovies = (currentTheater?.schedules || [])
    .map((schedule) => {
      const movie = movies.find((m) => m.id === schedule.movieId);
      return {
        movie,
        showtimes: schedule.showtimes,
      };
    })
    .filter((item) => item.movie !== undefined && matchesMovieTitle(item.movie, keyword));

  return (
    <section id="showtimes" className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-16">
      <div className="rounded-3xl border border-white/10 bg-neutral-900/40 p-6 sm:p-8 backdrop-blur-md">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-red-500">
              Lịch chiếu trực tiếp
            </span>
            <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold text-white">
              Suất Chiếu Hôm Nay Theo Rạp
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-neutral-400">
              Cập nhật liên tục các suất chiếu tại hệ thống rạp CineFlow
            </p>
          </div>

          {/* Theater Pill Selector */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {theaters.map((th) => (
              <button
                key={th.id}
                type="button"
                onClick={() => setSelectedTheaterId(th.id)}
                className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition-all ${
                  selectedTheaterId === th.id
                    ? "bg-red-600 text-white shadow-lg shadow-red-600/30"
                    : "border border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                {th.name}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <MovieSearchInput value={keyword} onChange={onKeywordChange} label="Tìm phim trong lịch chiếu" placeholder="Tìm phim đang chiếu tại rạp này…" />
          <p role="status" className="pb-3 text-xs text-neutral-400">{scheduledMovies.length} phim có lịch tại rạp đang chọn</p>
        </div>

        {/* Current Theater Address Info */}
        {currentTheater && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-400 bg-neutral-950/40 px-4 py-2.5 rounded-xl border border-white/5">
            <span className="flex items-center gap-1.5">
              <span>📍</span>
              <strong className="text-neutral-200">{currentTheater.name}:</strong>{" "}
              {currentTheater.address}
            </span>
            <span className="text-neutral-400">
              Hotline: <strong className="text-red-400">{currentTheater.phone}</strong> · {currentTheater.roomsCount} phòng chiếu
            </span>
          </div>
        )}

        {/* Scheduled Movies List */}
        <div className="mt-8 space-y-6">
          {scheduledMovies.length === 0 && <div className="rounded-xl border border-dashed border-white/15 p-8 text-center">
            <p className="text-sm text-neutral-400">Không tìm thấy phim phù hợp trong lịch của rạp này.</p>
            <p className="mt-2 text-xs text-neutral-500">Thử chọn rạp khác hoặc đổi từ khóa.</p>
            {keyword && <button type="button" onClick={() => onKeywordChange("")} className="mt-4 text-xs font-semibold text-red-400 hover:underline">Xóa từ khóa</button>}
          </div>}
          {scheduledMovies.map(({ movie, showtimes }) => {
            if (!movie) return null;
            return (
              <div
                key={movie.id}
                className="flex flex-col gap-4 rounded-2xl border border-white/5 bg-neutral-950/60 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5 transition-colors hover:border-white/10"
              >
                {/* Poster Thumbnail */}
                <div className="flex items-center gap-4 sm:w-72 shrink-0">
                  <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-xl bg-neutral-800 shadow-md">
                    <Image unoptimized width={64} height={96}
                      src={movie.posterUrl}
                      alt={movie.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded bg-red-600 px-1.5 py-0.2 text-[10px] font-bold text-white">
                        {movie.ageRating}
                      </span>
                      <span className="text-[11px] font-semibold text-amber-400">
                        ★ {movie.rating.toFixed(1)}
                      </span>
                    </div>
                    <h3 className="truncate text-sm sm:text-base font-bold text-white mt-1">
                      {movie.title}
                    </h3>
                    <p className="text-[11px] text-neutral-400">
                      {movie.genres.slice(0, 2).join(", ")} · {movie.durationMinutes}p
                    </p>
                  </div>
                </div>

                {/* Showtimes Pills */}
                <div className="flex-1">
                  <div className="flex flex-wrap gap-2.5">
                    {showtimes.map((st) => (
                      <Link
                        key={st.id}
                        href={`/booking/seats?movieId=${movie.id}&theaterId=${currentTheater.id}&showtimeId=${st.id}`}
                        className="group flex flex-col items-center rounded-xl border border-neutral-700/80 bg-neutral-800/80 px-3.5 py-2 text-center transition-all hover:scale-105 hover:border-red-500 hover:bg-red-600/10 shadow-sm"
                      >
                        <span className="text-sm font-bold text-white group-hover:text-red-400">
                          {st.time}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-medium">
                          {st.format}
                        </span>
                        <span className="text-[9px] text-neutral-400 font-semibold mt-0.5">
                          {st.price.toLocaleString("vi-VN")}đ
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
