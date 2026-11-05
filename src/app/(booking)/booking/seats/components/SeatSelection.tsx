"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getAccessToken } from "@/lib/api";
import { cinemaRequest, countdown, dateLabel, timeLabel, price, type CinemaSeat, type Screening } from "@/components/cinema/cinema-api";
import { demoScreening, demoSeats } from "@/components/cinema/demo-data";
import Poster from "@/components/cinema/Poster";
import styles from "@/components/cinema/cinema.module.css";

function subscribeToken(listener: () => void) {
  window.addEventListener("storage", listener); window.addEventListener("focus", listener);
  return () => { window.removeEventListener("storage", listener); window.removeEventListener("focus", listener); };
}

export default function SeatSelection() {
  const params = useSearchParams();
  const id = params.get("showtimeId") || "";
  const demo = params.get("demo") === "1" || /^st-/.test(id) || /^m-/.test(params.get("movieId") || "");
  return <SeatScreen key={`${demo}:${id}:${params.get("date")}`} id={id} demo={demo} movieId={params.get("movieId")} day={params.get("date")} />;
}

function SeatScreen({ id, demo, movieId, day }: { id: string; demo: boolean; movieId: string | null; day: string | null }) {
  const token = useSyncExternalStore(subscribeToken, getAccessToken, () => null);
  const [now, setNow] = useState(() => Date.now());
  const [epoch] = useState(() => Date.now());
  const [demoHolds, setDemoHolds] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [booking, setBooking] = useState<string | null>(null);
  const action = useRef<AbortController | null>(null);
  const tokens = useRef<Record<number, string>>({});
  const validId = demo || /^[1-9]\d*$/.test(id);
  const screening = useQuery({ queryKey: ["cinema-screening", demo, id, movieId, day], enabled: validId, queryFn: async ({ signal }) => {
    if (demo) { const result = demoScreening(id, movieId || "m-1", day); if (!result) throw new Error("Suất chiếu mẫu không tồn tại."); return result; }
    return cinemaRequest<Screening>(`/showtimes/${id}`, { signal });
  } });
  const matrix = useQuery({ queryKey: ["cinema-seats", demo, id, token], enabled: validId, refetchInterval: demo ? false : 3000, refetchIntervalInBackground: false, queryFn: async ({ signal }) => {
    if (demo) return { seats: demoSeats };
    const result = await cinemaRequest<{ seats: CinemaSeat[] }>(`/seats/matrix/showtime/${id}`, { signal });
    if (!Array.isArray(result.seats)) throw new Error("Dữ liệu sơ đồ ghế không hợp lệ.");
    return result;
  } });
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => { clearInterval(timer); action.current?.abort(); }; }, []);
  const elapsed = Math.max(0, Math.floor((now - (demo ? epoch : matrix.dataUpdatedAt)) / 1000));
  const seats = (matrix.data?.seats || []).map((seat): CinemaSeat => {
    const localDeadline = demoHolds[seat.id];
    if (demo && localDeadline > now) return { ...seat, status: "HOLDING", isHeldByMe: true, canRelease: true, remainingTtl: Math.max(0, Math.ceil((localDeadline - now) / 1000)) };
    const remainingTtl = Math.max(0, seat.remainingTtl - elapsed);
    return { ...seat, remainingTtl, ...(demo && seat.status === "HOLDING" && remainingTtl === 0 ? { status: "AVAILABLE" as const } : {}) };
  });
  const mine = seats.filter((seat) => seat.status === "HOLDING" && seat.isHeldByMe);
  const soonest = mine.length ? Math.min(...mine.map((seat) => seat.remainingTtl)) : 300;
  const stale = !matrix.data || matrix.isError || (!demo && now - matrix.dataUpdatedAt > 12000);
  const rows = [...new Set(seats.map((seat) => seat.row))];
  const maxColumn = Math.max(1, ...seats.map((seat) => seat.column));
  const info = screening.data;
  const movie = info?.movie;
  const total = mine.reduce((sum, seat) => sum + Number(info?.basePrice || 0) * seat.priceMultiplier, 0);
  const canBook = mine.length > 0 && mine.every((seat) => seat.canRelease && seat.remainingTtl > 0) && !stale && !busy && !booking;

  async function choose(seat: CinemaSeat) {
    if (busy || stale || action.current) return;
    setActionError(""); setMessage("");
    if (demo) {
      setDemoHolds((current) => { const next = { ...current }; if (seat.isHeldByMe) delete next[seat.id]; else next[seat.id] = Date.now() + 300000; return next; });
      setMessage(seat.isHeldByMe ? `Đã bỏ chọn ${seat.seatNumber} trong bản xem thử.` : `Đã chọn ${seat.seatNumber} trong bản xem thử.`);
      return;
    }
    if (!token) { setActionError("Đăng nhập để giữ ghế. Bạn vẫn có thể xem trạng thái ghế mà không cần đăng nhập."); return; }
    const controller = new AbortController(); action.current = controller; setBusy(true);
    try {
      if (seat.isHeldByMe) {
        const hold = tokens.current[seat.id] ? { holdToken: tokens.current[seat.id] } : await cinemaRequest<{ holdToken: string }>("/bookings/hold-seat", { method: "POST", signal: controller.signal, body: JSON.stringify({ showtimeId: Number(id), seatId: seat.id }) });
        await cinemaRequest("/bookings/release-seat", { method: "POST", signal: controller.signal, body: JSON.stringify({ showtimeId: Number(id), seatId: seat.id, holdToken: hold.holdToken }) });
        delete tokens.current[seat.id];
        setMessage(`Đã bỏ chọn ghế ${seat.seatNumber}.`);
      } else {
        const hold = await cinemaRequest<{ holdToken: string }>("/bookings/hold-seat", { method: "POST", signal: controller.signal, body: JSON.stringify({ showtimeId: Number(id), seatId: seat.id }) });
        if (!hold.holdToken) throw new Error("Không nhận được mã giữ ghế.");
        tokens.current[seat.id] = hold.holdToken;
        setMessage(`Ghế ${seat.seatNumber} đã được giữ cho bạn.`);
      }
    } catch (cause) { if (!controller.signal.aborted) { delete tokens.current[seat.id]; setActionError(cause instanceof Error ? cause.message : "Không thể giữ ghế, vui lòng thử lại."); } }
    finally { action.current = null; if (!controller.signal.aborted) { setBusy(false); void matrix.refetch(); } }
  }

  async function createBooking() {
    if (!canBook || action.current) return;
    setActionError("");
    if (demo) { setMessage(`Bạn đã chọn ${mine.map((seat) => seat.seatNumber).join(", ")}. Đây là bản xem thử, chưa tạo booking hoặc thanh toán.`); return; }
    const controller = new AbortController(); action.current = controller; setBusy(true);
    try {
      const holdTokens: Record<number, string> = {};
      for (const seat of mine) {
        if (!tokens.current[seat.id]) {
          const hold = await cinemaRequest<{ holdToken: string }>("/bookings/hold-seat", { method: "POST", signal: controller.signal, body: JSON.stringify({ showtimeId: Number(id), seatId: seat.id }) });
          tokens.current[seat.id] = hold.holdToken;
        }
        holdTokens[seat.id] = tokens.current[seat.id];
      }
      const result = await cinemaRequest<{ bookingCode: string }>("/bookings/create", { method: "POST", signal: controller.signal, body: JSON.stringify({ showtimeId: Number(id), seatIds: mine.map((seat) => seat.id), holdTokens }) });
      setBooking(result.bookingCode); setMessage("Đã tạo booking chờ thanh toán. Chưa thực hiện thanh toán hoặc trừ tiền.");
    } catch (cause) { if (!controller.signal.aborted) setActionError(cause instanceof Error ? cause.message : "Chưa tạo được booking."); }
    finally { action.current = null; if (!controller.signal.aborted) { setBusy(false); void matrix.refetch(); } }
  }

  if (!validId) return <div className={styles.page}><div className={styles.container}><div className={styles.empty}><h1>Chọn một suất chiếu trước nhé</h1><p>Tìm bộ phim bạn yêu thích để tiếp tục đến sơ đồ ghế.</p><Link href="/movies" className={styles.primary}>Khám phá phim →</Link></div></div></div>;
  return <div className={styles.page}><div className={styles.container}>
    <div className={styles.bookingTop}><Link href={demo ? "/movies?demo=1" : "/movies"} className={styles.backLink}>← Quay lại chọn phim</Link><div className={styles.steps}><span className={styles.completedStep}>✓ Chọn phim</span><i /><strong>02 <span>Chọn ghế</span></strong><i /><span>03 <span>Đặt vé</span></span></div></div>
    {demo && <div className={styles.demoNotice}><span>✦ BẢN XEM THỬ</span> Sơ đồ mẫu có thể tương tác. Không tạo booking hoặc thanh toán thật.</div>}
    <div className={styles.bookingTitle}><div><p className={styles.eyebrow}>CHỖ NGỒI ĐẸP. TRẢI NGHIỆM TRỌN VẸN.</p><h1>Chọn chỗ cho <em>cảm xúc.</em></h1></div><div className={styles.liveBadge}><span />{demo ? "Sơ đồ minh họa" : "Cập nhật mỗi 3 giây"}</div></div>
    {screening.isError && <p role="alert" className={styles.error}>{screening.error.message}</p>}
    <div className={styles.bookingLayout}>
      <section className={styles.seatPanel} aria-label="Sơ đồ ghế">
        <div className={styles.roomHeading}><div><strong>{info?.room?.cinema?.name || "Rạp chiếu phim"}</strong><p>{info?.room?.name || "Đang tải phòng chiếu…"} · {info ? `${timeLabel(info.startTime)} — ${dateLabel(info.startTime)}` : ""}</p></div><span>2D</span></div>
        <div className={styles.screen}><div /><span>MÀN HÌNH</span></div>
        {matrix.isError ? <div role="alert" className={styles.mapError}><h2>Chưa đồng bộ được ghế</h2><p>{matrix.error.message}</p><button type="button" className={styles.secondary} onClick={() => void matrix.refetch()}>Tải lại sơ đồ</button><Link href="/movies?demo=1" className={styles.textButton}>Xem giao diện mẫu ↗</Link></div> : matrix.isPending ? <p className={styles.mapLoading}>Đang mở cửa phòng chiếu…</p> : (
          <div className={styles.seatScroll}><div className={styles.seatRows}>{rows.map((row) => <div key={row} className={styles.seatRow}><span className={styles.rowLabel}>{row}</span><div className={styles.seatGrid} style={{ gridTemplateColumns: `repeat(${maxColumn}, 38px)` }}>{seats.filter((seat) => seat.row === row).map((seat) => {
            const owned = seat.status === "HOLDING" && seat.isHeldByMe;
            const label = seat.status === "AVAILABLE" ? "Ghế trống" : seat.status === "BOOKED" ? "Đã đặt" : seat.status === "INACTIVE" ? "Ngừng sử dụng" : owned ? "Bạn đang giữ" : "Người khác đang giữ";
            return <button key={seat.id} type="button" style={{ gridColumn: seat.column, marginLeft: seat.column > Math.floor(maxColumn / 2) ? 16 : undefined }} className={`${styles.seat} ${seat.type === "VIP" ? styles.vip : ""} ${owned ? styles.mine : seat.status === "BOOKED" ? styles.booked : seat.status === "HOLDING" ? styles.held : seat.status === "INACTIVE" ? styles.inactive : ""}`} aria-pressed={owned} aria-label={`${seat.seatNumber}, ${seat.type}, ${label}${seat.status === "HOLDING" ? `, còn ${countdown(seat.remainingTtl)}` : ""}`} title={`${seat.seatNumber} · ${label} · ${price(Number(info?.basePrice || 0) * seat.priceMultiplier)}`} disabled={stale || busy || booking !== null || !info || (seat.status !== "AVAILABLE" && !(owned && seat.canRelease && seat.remainingTtl > 0))} onClick={() => void choose(seat)}><span>{seat.column}</span>{owned && <small>{countdown(seat.remainingTtl)}</small>}</button>;
          })}</div><span className={styles.rowLabel}>{row}</span></div>)}</div></div>
        )}
        {!matrix.isPending && !matrix.isError && !seats.length && <p className={styles.mapLoading}>Phòng chiếu chưa được cấu hình ghế.</p>}
        <div className={styles.legend}>{[[styles.availableSwatch, "Ghế trống"], [styles.vipSwatch, "Ghế VIP"], [styles.mineSwatch, "Bạn đang giữ"], [styles.heldSwatch, "Đang giữ"], [styles.bookedSwatch, "Đã đặt"], [styles.inactiveSwatch, "Ngừng sử dụng"]].map(([color, label]) => <span key={label}><i className={color} />{label}</span>)}</div>
        <div className={styles.seatHint}><span>ⓘ</span><p>Bấm vào ghế trống để chọn, bấm lại để bỏ chọn.<br />Ghế đã đặt hoặc người khác đang giữ không thể chọn.</p>{!demo && <button type="button" onClick={() => void matrix.refetch()} className={styles.textButton}>Làm mới ↻</button>}</div>
      </section>
      <aside className={styles.ticket}>
        <div className={styles.ticketFilm}><Poster src={movie?.posterUrl} title={movie?.title || "Phim"} className={styles.miniPoster} /><div><span className={styles.ticketOverline}>TẤM VÉ CỦA BẠN</span><h2>{movie?.title || "Đang tải phim…"}</h2><p>{movie?.genres?.map((genre) => genre.name).join(" · ")}</p><small>{movie?.ageRating || "2D"} <span>•</span> {movie?.durationMinutes || "—"} phút</small></div></div>
        <dl className={styles.ticketDetails}><div><dt>Rạp chiếu</dt><dd>{info?.room?.cinema?.name || "—"}</dd></div><div><dt>Suất chiếu</dt><dd>{info ? `${timeLabel(info.startTime)} · ${dateLabel(info.startTime)}` : "—"}</dd></div><div><dt>Phòng chiếu</dt><dd>{info?.room?.name || "—"}</dd></div></dl>
        <div className={styles.perforation}><span /><i /><span /></div>
        <div className={styles.chosenHeading}><h3>Ghế đã chọn</h3><span>{mine.length} ghế</span></div>
        <div className={styles.selectedChips}>{mine.length ? mine.map((seat) => <button key={seat.id} type="button" disabled={!seat.canRelease || busy || stale || !!booking} onClick={() => void choose(seat)} aria-label={`Bỏ chọn ${seat.seatNumber}`}>{seat.seatNumber} <span>×</span></button>) : <p>Chưa chọn ghế nào.<br /><small>Chọn một chỗ ngồi yêu thích trên sơ đồ.</small></p>}</div>
        {mine.length > 0 && <div className={styles.holdTimer}><span>◷ Giữ ghế còn lại</span><strong>{countdown(soonest)}</strong></div>}
        <div className={styles.total}><div><span>Tạm tính</span><small>{mine.length} ghế · Giá theo loại ghế</small></div><strong>{price(total)}</strong></div>
        {!demo && !token && <p className={styles.loginNote}><Link href="/login">Đăng nhập</Link> để giữ ghế và tạo booking.</p>}
        <button type="button" disabled={!canBook} onClick={() => void createBooking()} className={styles.primary}>{busy ? "Đang xử lý…" : booking ? "Đã tạo booking ✓" : demo ? "Xem tóm tắt lựa chọn →" : "Tạo booking →"}</button>
        <p className={styles.ticketNote}>{demo ? "Bản xem thử không phát sinh giao dịch." : "Ghế được giữ tối đa 5 phút. Tạo booking không gia hạn thời gian giữ ghế."}</p>
        {booking && <p className={styles.success}>Mã booking: <strong>{booking}</strong><br />Trạng thái: Chờ thanh toán.</p>}
        {booking && (
          <div style={{ marginTop: "12px" }}>
            <Link
              href="/my-tickets"
              style={{
                display: "block",
                textAlign: "center",
                padding: "10px 16px",
                background: "linear-gradient(135deg, #e50914 0%, #b91c1c 100%)",
                color: "#ffffff",
                borderRadius: "8px",
                fontWeight: "700",
                fontSize: "13px",
                textDecoration: "none",
                boxShadow: "0 4px 12px rgba(229, 9, 20, 0.4)",
              }}
            >
              🎟️ Đến "Vé Của Tôi" để xem & thanh toán →
            </Link>
          </div>
        )}
      </aside>
    </div>
    {actionError && <p role="alert" className={styles.error}>{actionError}</p>}
    <p role="status" className={styles.actionMessage}>{message}</p>
    <div className={styles.bookingBottom}><span>✦ Một chỗ ngồi dành riêng cho bạn.</span><span>Giữ ghế tự động hết hạn · Trạng thái xác nhận từ máy chủ</span></div>
  </div></div>;
}
