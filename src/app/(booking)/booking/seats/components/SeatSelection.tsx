"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAccessToken } from "@/hooks/useClientState";
import { cinemaRequest, countdown, dateLabel, timeLabel, price, type CinemaSeat, type Screening } from "@/components/cinema/cinema-api";
import { demoScreening, demoSeats } from "@/components/cinema/demo-data";
import Poster from "@/components/cinema/Poster";
import styles from "@/components/cinema/cinema.module.css";

export default function SeatSelection() {
  const params = useSearchParams();
  const accessToken = useAccessToken();
  const id = params.get("showtimeId") || "";
  const demo = params.get("demo") === "1" || /^st-/.test(id) || /^m-/.test(params.get("movieId") || "");
  return <SeatScreen key={`${demo}:${id}:${params.get("date")}:${accessToken}`} id={id} demo={demo} movieId={params.get("movieId")} day={params.get("date")} />;
}

function SeatScreen({ id, demo, movieId, day }: { id: string; demo: boolean; movieId: string | null; day: string | null }) {
  const token = useAccessToken();
  const [now, setNow] = useState(() => Date.now());
  const [epoch] = useState(() => Date.now());
  const [demoHolds, setDemoHolds] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [bookingCode, setBookingCode] = useState<string | null>(null);
  
  const action = useRef<AbortController | null>(null);
  const holdTokensRef = useRef<Record<number, string>>({}); // Lưu trữ holdToken ứng với từng seatId cho UC8

  const validId = demo || /^[1-9]\d*$/.test(id);

  // Lấy thông tin suất chiếu & phim
  const screening = useQuery({
    queryKey: ["cinema-screening", demo, id, movieId, day],
    enabled: validId,
    queryFn: async ({ signal }) => {
      if (demo) {
        const result = demoScreening(id, movieId || "m-1", day);
        if (!result) throw new Error("Suất chiếu không tồn tại.");
        return result;
      }
      return cinemaRequest<Screening>(`/showtimes/${id}`, { signal });
    }
  });

  // Lấy ma trận sơ đồ ghế (Trạng thái ghế, Redis TTL, Race Condition protection)
  const matrix = useQuery({
    queryKey: ["cinema-seats", demo, id, token],
    enabled: validId,
    refetchInterval: demo ? false : 3000, // Polling cập nhật trạng thái ghế từ Redis
    queryFn: async ({ signal }) => {
      if (demo) return { seats: demoSeats };
      const result = await cinemaRequest<{ seats: CinemaSeat[] }>(`/seats/matrix/showtime/${id}`, { signal });
      if (!Array.isArray(result.seats)) throw new Error("Dữ liệu ma trận ghế không hợp lệ.");
      return result;
    }
  });

  // Bộ đếm thời gian thực cho TTL giữ ghế (UC7)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(timer);
      action.current?.abort();
    };
  }, []);

  const elapsed = Math.max(0, Math.floor((now - (demo ? epoch : matrix.dataUpdatedAt)) / 1000));

  const seats = (matrix.data?.seats || []).map((seat): CinemaSeat => {
    const localDeadline = demoHolds[seat.id];
    if (demo && localDeadline > now) {
      return { ...seat, status: "HOLDING", isHeldByMe: true, canRelease: true, remainingTtl: Math.max(0, Math.ceil((localDeadline - now) / 1000)) };
    }
    const remainingTtl = Math.max(0, seat.remainingTtl - elapsed);
    return { ...seat, remainingTtl, ...(demo && seat.status === "HOLDING" && remainingTtl === 0 ? { status: "AVAILABLE" as const } : {}) };
  });

  const mine = seats.filter((seat) => seat.status === "HOLDING" && seat.isHeldByMe);
  const soonest = mine.length ? Math.min(...mine.map((seat) => seat.remainingTtl)) : 300;
  const stale = !matrix.data || matrix.isError || (!demo && now - matrix.dataUpdatedAt > 12000);
  const info = screening.data;
  const movie = info?.movie;
  const total = mine.reduce((sum, seat) => sum + Number(info?.basePrice || 0) * seat.priceMultiplier, 0);
  const canBook = mine.length > 0 && mine.every((seat) => seat.canRelease && seat.remainingTtl > 0) && !stale && !busy && !bookingCode;

  async function recoverHoldToken(seatId: number, signal: AbortSignal) {
    const existing = holdTokensRef.current[seatId];
    if (existing) return existing;
    // Redis returns the current owner's original token without extending its TTL.
    const hold = await cinemaRequest<{ holdToken: string }>("/bookings/hold-seat", {
      method: "POST", signal, body: JSON.stringify({ showtimeId: Number(id), seatId }),
    });
    holdTokensRef.current[seatId] = hold.holdToken;
    return hold.holdToken;
  }

  // ==========================================
  // UC7: GIỮ GHẾ TẠM THỜI (HOLD SEAT & ATOMIC LOCK)
  // ==========================================
  async function handleToggleSeat(seat: CinemaSeat) {
    if ((seat.isHeldByMe && !seat.canRelease) || bookingCode || busy || stale || action.current || seat.status === "BOOKED" || seat.status === "INACTIVE") return;
    setActionError("");
    setMessage("");

    if (demo) {
      setDemoHolds((current) => {
        const next = { ...current };
        if (seat.isHeldByMe) delete next[seat.id];
        else next[seat.id] = Date.now() + 300000; // Giữ 5 phút (300,000 ms)
        return next;
      });
      return;
    }

    if (!token) {
      setActionError("Vui lòng đăng nhập để thực hiện giữ ghế trực tuyến.");
      return;
    }

    const controller = new AbortController();
    action.current = controller;
    setBusy(true);

    try {
      if (seat.isHeldByMe) {
        // Hủy giữ ghế (Release Seat)
        const holdToken = await recoverHoldToken(seat.id, controller.signal);
        await cinemaRequest("/bookings/release-seat", {
          method: "POST",
          signal: controller.signal,
          body: JSON.stringify({ showtimeId: Number(id), seatId: seat.id, holdToken })
        });
        delete holdTokensRef.current[seat.id];
        setMessage(`Đã hủy giữ ghế ${seat.seatNumber}.`);
      } else {
        // Gọi API giữ ghế tạm thời - Redis Atomic Lock chống tranh chấp (Race Condition)
        const hold = await cinemaRequest<{ holdToken: string }>("/bookings/hold-seat", {
          method: "POST",
          signal: controller.signal,
          body: JSON.stringify({ showtimeId: Number(id), seatId: seat.id })
        });
        holdTokensRef.current[seat.id] = hold.holdToken;
        setMessage(`Đã giữ thành công ghế ${seat.seatNumber} trong 5 phút.`);
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        setActionError(cause instanceof Error ? cause.message : "Ghế này đã có người khác chọn hoặc thao tác thất bại.");
      }
    } finally {
      action.current = null;
      if (!controller.signal.aborted) {
        setBusy(false);
        void matrix.refetch();
      }
    }
  }

  // ==========================================
  // UC8: TẠO ĐƠN ĐẶT VÉ (TRANSACTION ACID) & THANH TOÁN STRIPE
  // ==========================================
  async function handleCreateBooking() {
    if (!canBook || action.current) return;
    setActionError("");

    if (demo) {
      setBookingCode(`CF-DEMO-${crypto.randomUUID().slice(0, 8)}`);
      setMessage("Khởi tạo đơn hàng thành công (Demo). Sẵn sàng chuyển tới cổng thanh toán Stripe.");
      return;
    }

    const controller = new AbortController();
    action.current = controller;
    setBusy(true);

    try {
      const holdTokens: Record<number, string> = {};
      for (const seat of mine) {
        holdTokens[seat.id] = await recoverHoldToken(seat.id, controller.signal);
      }

      // Gửi yêu cầu tạo booking (Backend xử lý Transaction ACID gom các ghế đã hold)
      const result = await cinemaRequest<{ bookingCode: string }>("/bookings/create", {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify({ 
          showtimeId: Number(id), 
          seatIds: mine.map((seat) => seat.id), 
          holdTokens 
        })
      });

      setBookingCode(result.bookingCode);
      setMessage("Tạo đơn hàng thành công! Vui lòng hoàn tất thanh toán.");
    } catch (cause) {
      if (!controller.signal.aborted) {
        setActionError(cause instanceof Error ? cause.message : "Không thể khởi tạo đơn đặt vé.");
      }
    } finally {
      action.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  async function handleStripeCheckout() {
    if (!bookingCode || busy) return;
    if (demo) { setMessage("Chế độ xem thử không tạo giao dịch Stripe. Hãy chọn suất chiếu thực để thanh toán test."); return; }
    setBusy(true);
    setActionError("");
    try {
      const checkout = await cinemaRequest<{ url: string }>("/bookings/stripe/checkout", {
        method: "POST", body: JSON.stringify({ bookingCode })
      });
      window.location.assign(checkout.url);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Không thể mở Stripe Checkout.");
      setBusy(false);
    }
  }

  const rows = [...new Set(seats.map((seat) => seat.row))];
  const maxColumn = Math.max(1, ...seats.map((seat) => seat.column));

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Navigation Breadcrumb & Steps */}
        <div className={styles.bookingTop}>
          <Link href="/movies" className={styles.backLink}>← Quay lại danh sách phim</Link>
          <div className={styles.steps}>
            <span className={styles.completedStep}>01. Suất chiếu</span>
            <i />
            <strong className={styles.completedStep}>02. Chọn ghế (UC7)</strong>
            <i />
            <strong className={bookingCode ? styles.completedStep : ""}>03. Thanh toán (UC8)</strong>
          </div>
        </div>

        {demo && <div className={styles.demoNotice}><span>CHẾ ĐỘ XEM THỬ (DEMO)</span> Mô phỏng quy trình Giữ ghế tạm thời (UC7) & Thanh toán đơn hàng (UC8).</div>}

        <div className={styles.bookingTitle}>
          <div>
            <p className={styles.eyebrow}>HỆ THỐNG ĐẶT VÉ TRỰC TUYẾN</p>
            <h1>Chọn ghế và <em>Giữ chỗ</em></h1>
          </div>
        </div>

        <div className={styles.bookingLayout}>
          {/* Sơ đồ ghế ngồi */}
          <section className={styles.seatPanel}>
            <div className={styles.roomHeading}>
              <div>
                <strong>{info?.room?.cinema?.name || "CineFlow Cinema"}</strong>
                <p>{info?.room?.name || "Phòng chiếu chuẩn"} • {info ? `${timeLabel(info.startTime)} - ${dateLabel(info.startTime)}` : ""}</p>
              </div>
              <span>MÀN HÌNH</span>
            </div>

            <div className={styles.screen}><div /><span>MÀN HÌNH CHIẾU</span></div>

            <div className={styles.seatScroll}>
              <div className={styles.seatRows}>
                {rows.map((rowName) => (
                  <div key={rowName} className={styles.seatRow}>
                    <span className={styles.rowLabel}>{rowName}</span>
                    <div className={styles.seatGrid} style={{ gridTemplateColumns: `repeat(${maxColumn}, minmax(0, 1fr))` }}>
                      {seats.filter((s) => s.row === rowName).map((seat) => {
                        const isMine = seat.status === "HOLDING" && seat.isHeldByMe;
                        const isHeld = seat.status === "HOLDING" && !seat.isHeldByMe;
                        const isBooked = seat.status === "BOOKED";
                        const isInactive = seat.status === "INACTIVE";
                        const isVip = seat.type === "VIP";

                        let className = styles.seat;
                        if (isVip) className += ` ${styles.vip}`;
                        if (isMine) className += ` ${styles.mine}`;
                        if (isHeld) className += ` ${styles.held}`;
                        if (isBooked) className += ` ${styles.booked}`;
                        if (isInactive) className += ` ${styles.inactive}`;

                        return (
                          <button
                            key={seat.id}
                            type="button"
                            disabled={isBooked || isHeld || isInactive || busy}
                            onClick={() => handleToggleSeat(seat)}
                            className={className}
                            title={`Ghế ${seat.seatNumber} (${seat.type})`}
                          >
                            <span>{seat.column}</span>
                            <small>{seat.type[0]}</small>
                          </button>
                        );
                      })}
                    </div>
                    <span className={styles.rowLabel}>{rowName}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Chú thích trạng thái ghế */}
            <div className={styles.legend}>
              <span><i className={styles.availableSwatch} /> Ghế trống</span>
              <span><i className={styles.vipSwatch} /> Ghế VIP</span>
              <span><i className={styles.mineSwatch} /> Đang chọn</span>
              <span><i className={styles.heldSwatch} /> Đang giữ (Redis)</span>
              <span><i className={styles.bookedSwatch} /> Đã bán</span>
            </div>
          </section>

          {/* Ticket Summary & Checkout Panel (UC8) */}
          <aside className={styles.ticket}>
            {movie && (
              <div className={styles.ticketFilm}>
                <Poster src={movie.posterUrl} title={movie.title} className={styles.miniPoster} />
                <div>
                  <span className={styles.ticketOverline}>THÔNG TIN VÉ</span>
                  <h2>{movie.title}</h2>
                  <p>{info?.room?.cinema?.name}</p>
                  <small>{info ? `${timeLabel(info.startTime)} • ${dateLabel(info.startTime)}` : ""}</small>
                </div>
              </div>
            )}

            <div className={styles.perforation}><span /><i /><span /></div>

            <div className={styles.chosenHeading}>
              <h3>Ghế đang giữ (UC7)</h3>
              <span>{mine.length} ghế</span>
            </div>

            <div className={styles.selectedChips}>
              {mine.length === 0 ? (
                <p>Vui lòng chọn ghế trên sơ đồ để bắt đầu giữ chỗ tạm thời trong 5 phút.</p>
              ) : (
                mine.map((seat) => (
                  <button key={seat.id} type="button" onClick={() => handleToggleSeat(seat)} title="Bỏ chọn">
                    {seat.seatNumber} <span>×</span>
                  </button>
                ))
              )}
            </div>

            {mine.length > 0 && (
              <div className={styles.holdTimer}>
                <span>Thời gian giữ ghế (TTL):</span>
                <strong>{countdown(soonest)}</strong>
              </div>
            )}

            <div className={styles.total}>
              <span>Tổng tiền tạm tính</span>
              <strong>{price(total)}</strong>
            </div>

            {actionError && <p role="alert" className={styles.error}>{actionError}</p>}
            {message && <p className={styles.actionMessage}>{message}</p>}

            {/* Giao diện Thanh toán sau khi đặt vé thành công (UC8) */}
            {bookingCode ? (
              <div className={styles.success}>
                <strong>ĐƠN ĐANG CHỜ THANH TOÁN</strong>
                <p>Mã đơn hàng: <b>{bookingCode}</b></p>
                <p className="mt-2 text-xs">Thanh toán qua Stripe Test Mode trong thời hạn giữ ghế. Vé được xác nhận sau khi Stripe báo thành công.</p>
                <button
                  type="button"
                  className={styles.primary}
                  style={{ marginTop: "12px" }}
                  disabled={busy}
                  onClick={handleStripeCheckout}
                >
                  {busy ? "Đang mở Stripe..." : "Thanh toán qua Stripe Test Mode"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={!canBook}
                onClick={handleCreateBooking}
                className={styles.primary}
              >
                {busy ? "Đang xử lý Transaction..." : "Xác nhận đặt vé & Thanh toán (UC8)"}
              </button>
            )}

            <p className={styles.ticketNote}>Hệ thống tự động giải phóng ghế nếu hết thời gian đếm ngược hoặc không thanh toán.</p>
          </aside>
        </div>
      </div>
    </div>
  );
}