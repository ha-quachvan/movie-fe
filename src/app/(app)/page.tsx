"use client";

import { useState } from "react";
import { useQuery } from '@tanstack/react-query';
import HeroBanner from "@/components/home/HeroBanner";
import QuickBookingBar from "@/components/home/QuickBookingBar";
import MovieTabsSection from "@/components/home/MovieTabsSection";
import TodayShowtimes from "@/components/home/TodayShowtimes";
import FeatureHighlights from "@/components/home/FeatureHighlights";
import TrailerModal from "@/components/home/TrailerModal";
import ScrollToTop from "@/components/ScrollToTop";
import { homeMovies, homeTheaters, type Movie } from '@/lib/catalog';
import { getMovies, getCinemas, getShowtimes, readApiError } from '@/lib/api';

export default function HomePage() {
  const [trailerMovie, setTrailerMovie] = useState<Movie | null>(null);
  const [movieKeyword, setMovieKeyword] = useState("");
  const catalog = useQuery({
    queryKey: ['home-catalog'],
    queryFn: async () => {
      const [movies, cinemas, showtimes] = await Promise.all([getMovies(), getCinemas(), getShowtimes({status: 'SCHEDULED'})]);
      return {movies: homeMovies(movies), theaters: homeTheaters(cinemas, showtimes)};
    },
    refetchInterval: 30000,
  });
  const movies = catalog.data?.movies || [];
  const theaters = catalog.data?.theaters || [];

  const handleWatchTrailer = (movie: Movie) => {
    setTrailerMovie(movie);
  };

  const handleCloseTrailer = () => {
    setTrailerMovie(null);
  };

  return (
    <div
      className="min-h-screen bg-[#0e0708] text-[#fff7f7] selection:bg-red-600 selection:text-white"
      style={{ fontFamily: "var(--font-be-vietnam), system-ui, sans-serif" }}
    >
      {/* 1. Hero Banner Carousel */}
      {catalog.isLoading && <p role="status" className="p-12 text-center">Đang tải phim và lịch chiếu…</p>}
      {catalog.isError && <div role="alert" className="p-12 text-center"><p>{readApiError(catalog.error, 'Không thể tải danh mục phim.')}</p><button onClick={() => void catalog.refetch()}>Thử lại</button></div>}
      {!catalog.isLoading && !catalog.isError && movies.length === 0 && <p className="p-12 text-center">Chưa có phim trong hệ thống.</p>}
      <HeroBanner movies={movies} onWatchTrailer={handleWatchTrailer} />

      {/* 2. Thanh đặt vé nhanh (Floating Quick Booking Bar) */}
      <QuickBookingBar movies={movies} theaters={theaters} />

      {/* 3. Phim Đang Chiếu & Sắp Chiếu (Movie Tabs Grid) */}
      <MovieTabsSection movies={movies} onWatchTrailer={handleWatchTrailer} keyword={movieKeyword} onKeywordChange={setMovieKeyword} />

      {/* 4. Suất chiếu hôm nay theo rạp */}
      <TodayShowtimes theaters={theaters} movies={movies} keyword={movieKeyword} onKeywordChange={setMovieKeyword} />

      {/* 5. Ưu đãi & Khuyến mãi */}
      <section id="promotions" className="mx-auto max-w-6xl px-4 py-12"><h2 className="text-2xl font-bold">Ưu đãi</h2><p className="mt-3 text-neutral-400">Chưa có chương trình ưu đãi được công bố.</p></section>

      {/* 6. Điểm sáng nền tảng CineFlow */}
      <FeatureHighlights />

      {/* Popup xem trailer */}
      <TrailerModal
        isOpen={trailerMovie !== null}
        onClose={handleCloseTrailer}
        youtubeId={trailerMovie?.trailerYoutubeId || null}
        movieTitle={trailerMovie?.title || ""}
      />

      {/* Nút cuộn lên đầu trang */}
      <ScrollToTop />
    </div>
  );
}
