"use client";
import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getMovies, getShowtimes, Movie as BackendMovie } from "@/lib/api";
import { MOVIES, THEATERS } from "@/lib/mockData";
import { emptyFilters, timeLabel, price, type CinemaMovie, type CinemaShowtime,type Filters } from "@/components/cinema/cinema-api";
import { demoCatalog } from "@/components/cinema/demo-data";
import { useIsAdmin } from "@/hooks/useClientState";
import Poster from "@/components/cinema/Poster";
import styles from "@/components/cinema/cinema.module.css";

// Adapter map dữ liệu từ Backend NestJS, đồng thời tạo suất chiếu dùng được với sơ đồ ghế demo
function adaptBackendToCinemaMovie(m: BackendMovie): CinemaMovie {
  // Tìm xem bộ phim từ Backend có khớp với dữ liệu Demo trong mockData hay không
  const matchedDemoMovie = MOVIES.find(
    (demo) => String(demo.id) === String(m.id) || demo.title.toLowerCase() === m.title.toLowerCase()
  );

  let demoShowtimes: CinemaShowtime[] = [];

  // NẾU LÀ PHIM CÓ TRONG DEMO: Lấy suất chiếu từ mockData
  if (matchedDemoMovie) {
    const today = new Date().toISOString().split("T")[0];
    demoShowtimes = THEATERS.flatMap((theater) =>
      theater.schedules
        .filter((schedule) => schedule.movieId === matchedDemoMovie.id)
        .flatMap((schedule) =>
          schedule.showtimes.map((st) => ({
            id: st.id,
            startTime: `${today}T${st.time}:00+07:00`,
            basePrice: st.price,
            room: {
              id: st.room,
              name: st.room,
              cinema: { id: theater.id, name: theater.name },
            },
          }))
        )
    );
  }

  // NẾU KHÔNG CÓ TRONG DEMO: showtimes sẽ là [] rỗng (Giao diện sẽ báo "Lịch chiếu sẽ sớm được cập nhật.")
  return {
    id: String(m.id),
    title: m.title,
    description: m.description || "",
    durationMinutes: m.durationMinutes,
    releaseDate: m.releaseDate ? m.releaseDate.substring(0, 10) : "",
    genres: m.genres || [],
    ageRating: m.ageRating || "P",
    director: m.director || "",
    cast: m.cast || "",
    posterUrl: m.posterUrl || "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=800&auto=format&fit=crop",
    trailerUrl: m.trailerUrl || "",
    status: m.status,
    rating: Number(m.rating) || 0,
    showtimes: demoShowtimes,
  } as CinemaMovie;
}

function FilmCard({ movie, demo, day }: { movie: CinemaMovie; demo: boolean; day: string }) {
  const [expanded, setExpanded] = useState(false);
  const showtimes = movie.showtimes || [];

  return (
    <article className={styles.film}>
      {/* Click vào Poster chuyển sang trang chi tiết */}
      <Link href={`/movies/${movie.id}`} className={styles.posterWrap}>
        <Poster src={movie.posterUrl} title={movie.title} className={styles.poster} />
        <div className={styles.posterBadges}>
          <span className={styles.age}>{movie.ageRating || "PHIM"}</span>
          {Number(movie.rating) > 0 && <span className={styles.rating}>★ {Number(movie.rating).toFixed(1)}</span>}
        </div>
        <div className={styles.posterBottom}>
          <span>ĐIỆN ẢNH • 2D</span>
          <span>{movie.durationMinutes || "—"} PHÚT</span>
        </div>
      </Link>

      <div className={styles.filmBody}>
        <p className={styles.genre}>{movie.genres?.map((genre) => genre.name).join(" · ") || "Điện ảnh"}</p>
        
        {/* Click vào Tiêu đề chuyển sang trang chi tiết */}
        <h2>
          <Link href={`/movies/${movie.id}`} style={{ color: "inherit", textDecoration: "none" }}>
            {movie.title}
          </Link>
        </h2>

        {/* Dòng tóm tắt mô tả ngắn & đạo diễn */}
        {movie.director && (
          <p style={{ fontSize: "13px", color: "#aaa", margin: "4px 0" }}>
            Đạo diễn: <span style={{ color: "#eee" }}>{movie.director}</span>
          </p>
        )}

        <div className={styles.showtimeHeading}>
          <span>SUẤT CHIẾU</span>
          <span>{showtimes.length ? `Từ ${price(Math.min(...showtimes.map((item) => Number(item.basePrice))))}` : "Chưa mở bán"}</span>
        </div>

        <div className={styles.showtimeGrid}>
          {showtimes.slice(0, expanded ? undefined : 4).map((showtime) => {
            const params = new URLSearchParams({
              showtimeId: String(showtime.id),
              movieId: String(movie.id),
            });
            if (demo || !demo) {
              params.set("date", day || showtime.startTime.slice(0, 10));
            }
            return (
              <Link
                key={showtime.id}
                href={`/booking/seats?${params}`}
                className={styles.showtime}
                title={`${showtime.room?.cinema?.name || "Rạp"} · ${showtime.room?.name || ""} · ${price(showtime.basePrice)}`}
              >
                <strong>{timeLabel(showtime.startTime)}</strong>
                <small>{showtime.room?.cinema?.name || "Xem ghế"}</small>
              </Link>
            );
          })}
        </div>
        {showtimes.length > 4 && (
          <button type="button" className={styles.textButton} onClick={() => setExpanded(!expanded)}>
            {expanded ? "Thu gọn suất chiếu ↑" : `Xem thêm ${showtimes.length - 4} suất chiếu ↗`}
          </button>
        )}
        {!showtimes.length && <p className={styles.subtle}>Lịch chiếu sẽ sớm được cập nhật.</p>}
      </div>
    </article>
  );
}

export default function MovieExplorer() {
  const params = useSearchParams();
  const demo = params.get("demo") === "1";
  const [draft, setDraft] = useState<Filters>({ ...emptyFilters, keyword: params.get("keyword") || "" });
  const [applied, setApplied] = useState<Filters>(draft);
  const [status, setStatus] = useState("NOW_SHOWING");
  const [sort, setSort] = useState("title");
  const [filterError, setFilterError] = useState("");
  const userIsAdmin = useIsAdmin();

  const query = useQuery({
    queryKey: ["cinema-movies", demo, applied],
    queryFn: async () => {
      if (demo) return demoCatalog(applied);
      const [rawMovies, rawShowtimes] = await Promise.all([
        getMovies(),
        getShowtimes().catch(() => []),
      ]);

      let result = rawMovies.map((m) => {
        const realShowtimes: CinemaShowtime[] = rawShowtimes
          .filter((st) => st.movieId === m.id)
          .map((st) => ({
            id: String(st.id),
            startTime: st.startTime,
            basePrice: Number(st.basePrice),
            room: {
              id: String(st.roomId),
              name: st.room?.name || `Screen ${st.roomId}`,
              cinema: {
                id: String(st.room?.cinema?.id || "1"),
                name: st.room?.cinema?.name || "Rạp CineBook",
              },
            },
          }));

        const adapted = adaptBackendToCinemaMovie(m);
        if (realShowtimes.length > 0) {
          adapted.showtimes = realShowtimes;
        }
        return adapted;
      });

      if (applied.keyword) {
        const kw = applied.keyword.toLowerCase();
        result = result.filter((m) => m.title.toLowerCase().includes(kw));
      }
      if (applied.genre) {
        result = result.filter((m) => m.genres?.some((g) => g.name === applied.genre));
      }
      return result;
    },
  });

  const movies = (query.data || [])
    .filter((movie) => !movie.status || movie.status === status)
    .sort((a, b) => (sort === "rating" ? Number(b.rating || 0) - Number(a.rating || 0) : a.title.localeCompare(b.title, "vi")));

  const genres = [
    ...new Set([
      ...MOVIES.flatMap((movie) => movie.genres),
      ...(query.data || []).flatMap((movie) => movie.genres?.map((genre) => genre.name) || []),
    ]),
  ];

  const cinemas = demo
    ? THEATERS.map((item) => ({ id: item.id, name: item.name }))
    : [
        ...new Map(
          (query.data || [])
            .flatMap((movie) => movie.showtimes || [])
            .flatMap((item) =>
              item.room?.cinema?.id
                ? ([[String(item.room.cinema.id), { id: String(item.room.cinema.id), name: item.room.cinema.name || "Rạp chiếu" }]] as const)
                : []
            )
        ).values(),
      ];

  function update(key: keyof Filters, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function reset() {
    setDraft(emptyFilters);
    setApplied(emptyFilters);
    setFilterError("");
  }

  return (
    <div className={styles.page}>
      <section
        className={styles.hero}
        style={{
          backgroundImage: `linear-gradient(90deg,#100d11 10%,#100d11b0 65%,#100d1140),linear-gradient(0deg,#100d11,transparent),url('${MOVIES[0].backdropUrl}')`,
        }}
      >
        <div className={styles.container}>
          <p className={styles.eyebrow}>
            <span /> CHỌN PHIM HAY. TRỌN CẢM XÚC.
          </p>
          <h1>
            Một bộ phim.<br />
            <em>Vạn cảm xúc.</em>
          </h1>
          <p className={styles.heroText}>
            Tìm câu chuyện của bạn, chọn suất chiếu phù hợp
            <br className={styles.desktopOnly} /> và dành một chỗ cho những khoảnh khắc đáng nhớ.
          </p>
          <div className={styles.heroMeta}>
            <span>◉ Trải nghiệm điện ảnh</span>
            <span>✦ Đặt chỗ trong vài bước</span>
          </div>
        </div>
      </section>

      <div className={styles.container}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "16px 0" }}>
          <div className={styles.breadcrumb}>
            <Link href="/">Trang chủ</Link>
            <span>/</span>
            <span>Khám phá phim</span>
          </div>

          {userIsAdmin && (
            <Link
              href="/admin/movies"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                backgroundColor: "#e50914",
                color: "#ffffff",
                fontWeight: "bold",
                borderRadius: "6px",
                textDecoration: "none",
                fontSize: "14px",
                boxShadow: "0 2px 8px rgba(229, 9, 20, 0.4)",
              }}
            >
              ⚙ Quản Lý Phim (Admin) ↗
            </Link>
          )}
        </div>

        {demo && (
          <div className={styles.demoNotice}>
            <span>✦ BẢN XEM THỬ</span> Dữ liệu phim, suất chiếu và ghế mẫu để trải nghiệm giao diện.{" "}
            <Link href="/movies">Kết nối dữ liệu thật ↗</Link>
          </div>
        )}

        <div className={styles.catalogLayout}>
          <aside className={styles.filterPanel}>
            <div className={styles.panelHeading}>
              <h2>Bộ lọc phim</h2>
              <button type="button" onClick={reset}>
                Đặt lại
              </button>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (draft.minPrice && draft.maxPrice && Number(draft.minPrice) > Number(draft.maxPrice)) {
                  setFilterError("Giá tối thiểu phải nhỏ hơn hoặc bằng giá tối đa.");
                  return;
                }
                setFilterError("");
                setApplied({ ...draft });
              }}
            >
              <label>
                Tìm tên phim
                <div className={styles.searchInput}>
                  <span aria-hidden="true">⌕</span>
                  <input
                    value={draft.keyword}
                    onChange={(event) => update("keyword", event.target.value)}
                    placeholder="Bạn muốn xem phim gì?"
                  />
                </div>
              </label>
              <label>
                Thể loại
                <select value={draft.genre} onChange={(event) => update("genre", event.target.value)}>
                  <option value="">Tất cả thể loại</option>
                  {genres.map((genre) => (
                    <option key={genre}>{genre}</option>
                  ))}
                </select>
              </label>
              <label>
                Rạp chiếu
                <select value={draft.cinemaId} onChange={(event) => update("cinemaId", event.target.value)}>
                  <option value="">Tất cả rạp chiếu</option>
                  {cinemas.map((cinema) => (
                    <option key={cinema.id} value={cinema.id}>
                      {cinema.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Ngày chiếu
                <input type="date" value={draft.date} onChange={(event) => update("date", event.target.value)} />
              </label>
              <fieldset>
                <legend>Khoảng giá vé</legend>
                <div className={styles.priceInputs}>
                  <input
                    aria-label="Giá tối thiểu"
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="Từ"
                    value={draft.minPrice}
                    onChange={(event) => update("minPrice", event.target.value)}
                  />
                  <span>—</span>
                  <input
                    aria-label="Giá tối đa"
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="Đến"
                    value={draft.maxPrice}
                    onChange={(event) => update("maxPrice", event.target.value)}
                  />
                </div>
                <small>Giá vé cơ bản · VNĐ</small>
              </fieldset>
              {filterError && (
                <p role="alert" className={styles.error}>
                  {filterError}
                </p>
              )}
              <button type="submit" className={styles.primary} disabled={query.isFetching}>
                {query.isFetching ? "Đang tìm phim…" : "Áp dụng bộ lọc →"}
              </button>
            </form>
            <div className={styles.filterFoot}>
              Một chiếc vé nhỏ.
              <br />
              <strong>Một trải nghiệm lớn.</strong>
              <span>HẸN BẠN TẠI RẠP</span>
            </div>
          </aside>

          <section className={styles.results} aria-label="Kết quả tìm phim">
            <div className={styles.resultHeader}>
              <div className={styles.tabs} role="group" aria-label="Trạng thái phim">
                <button
                  type="button"
                  aria-pressed={status === "NOW_SHOWING"}
                  className={status === "NOW_SHOWING" ? styles.activeTab : ""}
                  onClick={() => setStatus("NOW_SHOWING")}
                >
                  Đang chiếu
                </button>
                <button
                  type="button"
                  aria-pressed={status === "COMING_SOON"}
                  className={status === "COMING_SOON" ? styles.activeTab : ""}
                  onClick={() => setStatus("COMING_SOON")}
                >
                  Sắp chiếu
                </button>
              </div>
              <label className={styles.sort}>
                Sắp xếp
                <select value={sort} onChange={(event) => setSort(event.target.value)}>
                  <option value="title">Tên phim A–Z</option>
                  <option value="rating">Đánh giá cao</option>
                </select>
              </label>
            </div>

            <div className={styles.resultCount} role="status">
              {query.isPending ? "Đang tìm câu chuyện dành cho bạn…" : `${movies.length} phim dành cho bạn`}
              <span>CHỌN MỘT SUẤT CHIẾU ĐỂ XEM GHẾ</span>
            </div>

            {query.isError ? (
              <div className={styles.empty}>
                <span>⌁</span>
                <h2>Chưa tải được phim</h2>
                <p>{(query.error as Error).message}</p>
                <div className={styles.inlineActions}>
                  <button type="button" className={styles.secondary} onClick={() => void query.refetch()}>
                    Thử lại
                  </button>
                  <Link href="/movies?demo=1" className={styles.primary}>
                    Khám phá bản xem thử ↗
                  </Link>
                </div>
              </div>
            ) : query.isPending ? (
              <div className={styles.movieGrid}>
                {[1, 2, 3].map((id) => (
                  <div key={id} className={styles.skeleton} />
                ))}
              </div>
            ) : !movies.length ? (
              <div className={styles.empty}>
                <span>⌕</span>
                <h2>Chưa tìm thấy phim phù hợp</h2>
                <p>Thử đổi ngày chiếu hoặc nới rộng bộ lọc của bạn.</p>
                <button type="button" onClick={reset} className={styles.secondary}>
                  Xóa bộ lọc
                </button>
              </div>
            ) : (
              <div className={styles.movieGrid}>
                {movies.map((movie) => (
                  <FilmCard key={movie.id} movie={movie} demo={demo} day={applied.date} />
                ))}
              </div>
            )}
          </section>
        </div>

        <div className={styles.bottomNote}>
          <span>✦</span>
          <p>Phim hay hơn khi cùng nhau trải nghiệm.</p>
          <Link href="/#showtimes">Xem lịch chiếu tại rạp ↗</Link>
        </div>
      </div>
    </div>
  );
}