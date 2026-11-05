"use client";

import Image from "next/image";

import { Movie } from "@/lib/mockData";

interface MovieCardProps {
  movie: Movie;
  onWatchTrailer: (movie: Movie) => void;
}

export default function MovieCard({ movie, onWatchTrailer }: MovieCardProps) {
  const getAgeBadgeColor = (rating: Movie["ageRating"]) => {
    switch (rating) {
      case "P":
        return "bg-emerald-600 text-white";
      case "T13":
        return "bg-yellow-600 text-white";
      case "T16":
        return "bg-orange-600 text-white";
      case "T18":
        return "bg-red-600 text-white";
      default:
        return "bg-neutral-700 text-white";
    }
  };

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/5 bg-neutral-900/60 transition-all duration-300 hover:-translate-y-1.5 hover:border-red-500/30 hover:shadow-2xl hover:shadow-red-600/20">
      {/* Poster Wrap (aspect ratio 2:3) */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-neutral-950">
        <Image unoptimized width={600} height={900}
          src={movie.posterUrl}
          alt={movie.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        />

        {/* Top Badges (Age rating, Rating score) */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10 pointer-events-none">
          <span
            className={`rounded-md px-2 py-0.5 text-[11px] font-extrabold tracking-wider shadow-md backdrop-blur-sm ${getAgeBadgeColor(
              movie.ageRating
            )}`}
          >
            {movie.ageRating}
          </span>
          <span className="flex items-center gap-1 rounded-md bg-black/70 px-2 py-0.5 text-[11px] font-bold text-amber-400 backdrop-blur-md shadow-md border border-white/10">
            ★ {movie.rating.toFixed(1)}
          </span>
        </div>

        {/* Formats Badges (Bottom Left of Poster) */}
        <div className="absolute bottom-2.5 left-2.5 flex flex-wrap gap-1 z-10 pointer-events-none">
          {movie.formats.slice(0, 2).map((fmt) => (
            <span
              key={fmt}
              className="rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-300 border border-white/10 backdrop-blur-xs"
            >
              {fmt}
            </span>
          ))}
        </div>

        {/* Hover Action Overlay */}
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2.5 bg-neutral-950/75 p-4 opacity-0 backdrop-blur-xs transition-opacity duration-300 group-hover:opacity-100">
          <a
            href={`/movies?demo=1&keyword=${encodeURIComponent(movie.title)}`}
            className="w-full rounded-xl bg-gradient-to-r from-red-600 to-rose-600 py-2.5 text-center text-xs sm:text-sm font-bold text-white shadow-lg shadow-red-600/30 transition-all hover:scale-105 active:scale-95"
          >
            Đặt Vé Ngay
          </a>

          <button
            type="button"
            onClick={() => onWatchTrailer(movie)}
            className="w-full rounded-xl border border-white/20 bg-white/10 py-2 text-center text-xs font-semibold text-white transition-all hover:bg-white/20"
          >
            ▶ Xem Trailer
          </button>
        </div>
      </div>

      {/* Movie Details Info */}
      <div className="flex flex-1 flex-col justify-between p-3.5 sm:p-4">
        <div>
          <h3 className="line-clamp-1 text-sm sm:text-base font-bold text-white group-hover:text-red-400 transition-colors">
            {movie.title}
          </h3>
          <p className="mt-0.5 text-[11px] sm:text-xs text-neutral-400 line-clamp-1">
            {movie.genres.join(", ")}
          </p>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2.5 text-[11px] text-neutral-400">
          <span>⏱️ {movie.durationMinutes} phút</span>
          <span className="text-neutral-400 font-medium">{movie.releaseDate}</span>
        </div>
      </div>
    </article>
  );
}
