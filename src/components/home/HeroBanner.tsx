"use client";

import Image from "next/image";

import { useEffect, useState } from "react";
import { Movie } from "@/lib/mockData";

interface HeroBannerProps {
  movies: Movie[];
  onWatchTrailer: (movie: Movie) => void;
}

export default function HeroBanner({ movies, onWatchTrailer }: HeroBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const featured = movies.filter((m) => m.isHot || m.status === "now_showing").slice(0, 5);
  const currentMovie = featured[currentIndex] || featured[0];

  useEffect(() => {
    if (isPaused || featured.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % featured.length);
    }, 6500);
    return () => clearInterval(interval);
  }, [isPaused, featured.length]);

  if (!currentMovie) return null;

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % featured.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + featured.length) % featured.length);
  };

  return (
    <div
      className="relative h-[560px] sm:h-[640px] lg:h-[720px] w-full overflow-hidden bg-neutral-950"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Background Backdrops with crossfade transition */}
      {featured.map((movie, index) => (
        <div
          key={movie.id}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
            index === currentIndex ? "opacity-100 z-0 scale-100" : "opacity-0 -z-10 scale-105"
          }`}
          style={{ transitionProperty: "opacity, transform" }}
        >
          <Image unoptimized width={1920} height={1080}
            src={movie.backdropUrl}
            alt={movie.title}
            className="h-full w-full object-cover object-center filter brightness-[0.45] contrast-[1.08]"
          />
        </div>
      ))}

      {/* Cinematic Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0e0708] via-[#0e0708]/60 to-transparent z-10" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0e0708] via-[#0e0708]/75 to-transparent z-10" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_40%,rgba(239,68,68,0.18),transparent_50%)] z-10 pointer-events-none" />

      {/* Content Container */}
      <div className="relative z-20 mx-auto flex h-full max-w-6xl flex-col justify-end px-5 pb-20 sm:px-8 sm:pb-24 lg:pb-28">
        <div className="max-w-2xl">
          {/* Badges / Meta row */}
          <div className="flex flex-wrap items-center gap-2.5 mb-3.5">
            <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-red-600/30">
              Hot Tuần Này
            </span>
            <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-white backdrop-blur-sm">
              {currentMovie.ageRating}
            </span>
            <span className="flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-500/30 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
              ★ {currentMovie.rating.toFixed(1)}
            </span>
            <span className="text-xs text-neutral-300 font-medium">
              {currentMovie.durationMinutes} phút
            </span>
          </div>

          {/* Movie Title */}
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl drop-shadow-md">
            {currentMovie.title}
          </h1>

          {/* Original Title & Genres */}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-neutral-300">
            {currentMovie.originalTitle && (
              <span className="font-light italic text-neutral-400">
                ({currentMovie.originalTitle})
              </span>
            )}
            <span>•</span>
            <span className="text-red-400 font-medium">
              {currentMovie.genres.join(", ")}
            </span>
          </div>

          {/* Synopsis */}
          <p className="mt-4 line-clamp-3 text-sm text-neutral-300/90 sm:text-base leading-relaxed max-w-xl font-light">
            {currentMovie.synopsis}
          </p>

          {/* CTA Action Buttons */}
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <a
              href="#booking"
              className="inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-red-600 to-rose-600 px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-red-600/35 transition-all hover:scale-105 hover:shadow-red-600/50"
            >
              <span>🎟️</span>
              <span>Đặt Vé Ngay</span>
            </a>

            <button
              type="button"
              onClick={() => onWatchTrailer(currentMovie)}
              className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-md transition-all hover:bg-white/20 hover:border-white/40"
            >
              <svg className="h-4 w-4 fill-current text-red-500" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span>Xem Trailer</span>
            </button>
          </div>
        </div>
      </div>

      {/* Slider Controls (Prev / Next Buttons) */}
      <button
        type="button"
        onClick={prevSlide}
        aria-label="Phim trước"
        className="absolute left-4 top-1/2 z-20 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition-all hover:bg-black/75 hover:scale-110 border border-white/10 hidden sm:flex"
      >
        ‹
      </button>
      <button
        type="button"
        onClick={nextSlide}
        aria-label="Phim kế tiếp"
        className="absolute right-4 top-1/2 z-20 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition-all hover:bg-black/75 hover:scale-110 border border-white/10 hidden sm:flex"
      >
        ›
      </button>

      {/* Indicator Dots */}
      <div className="absolute bottom-6 right-6 sm:right-12 z-20 flex items-center gap-2">
        {featured.map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setCurrentIndex(idx)}
            aria-label={`Chuyển đến phim ${idx + 1}`}
            className={`h-2 rounded-full transition-all duration-300 ${
              idx === currentIndex ? "w-8 bg-red-600" : "w-2 bg-white/40 hover:bg-white/70"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
