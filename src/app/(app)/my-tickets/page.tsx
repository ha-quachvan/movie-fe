"use client";

import Image from "next/image";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getMyBookings,
  cancelAndRefundTicket,
  mockPayBooking,
  BookingDetail,
  BookingTicket,
  getAccessToken,
  readApiError,
  isAdmin,
} from "@/lib/api";

type FilterTab = "ALL" | "CONFIRMED" | "CANCELLED" | "PENDING";

export default function MyTicketsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [selectedBookingForDetail, setSelectedBookingForDetail] = useState<BookingDetail | null>(null);
  const [bookingToCancel, setBookingToCancel] = useState<BookingDetail | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Kiểm tra đăng nhập
  useEffect(() => {
    if (typeof window !== "undefined" && !getAccessToken()) {
      router.push("/login?redirect=/my-tickets");
    }
  }, [router]);

  // Fetch lịch sử vé đã đặt của user
  const {
    data: bookings = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["my-tickets"],
    queryFn: getMyBookings,
  });

  // Mutation hủy vé & hoàn tiền
  const cancelMutation = useMutation({
    mutationFn: (bookingCode: string) => cancelAndRefundTicket(bookingCode),
    onSuccess: (data) => {
      setToast({
        message: `Hủy vé ${data.bookingCode} thành công. Kiểm tra trạng thái hoàn tiền trong chi tiết vé.`,
        type: "success",
      });
      setBookingToCancel(null);
      setCancelReason("");
      queryClient.invalidateQueries({ queryKey: ["my-tickets"] });
    },
    onError: (err) => {
      setToast({
        message: readApiError(err, "Không thể hủy vé. Vui lòng kiểm tra lại điều kiện."),
        type: "error",
      });
    },
  });

  // Mutation thanh toán vé mô phỏng (Stripe Mock)
  const payMutation = useMutation({
    mutationFn: (bookingCode: string) => mockPayBooking(bookingCode),
    onSuccess: (data) => {
      setToast({
        message: `Thanh toán thành công đơn vé ${data?.booking?.bookingCode || ""}! Vé đã chuyển sang trạng thái hợp lệ.`,
        type: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["my-tickets"] });
    },
    onError: (err) => {
      setToast({
        message: readApiError(err, "Không thể thanh toán đơn vé. Vui lòng thử lại."),
        type: "error",
      });
    },
  });


  // Tự tắt Toast sau 5 giây
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Format tiền tệ VND
  const formatCurrency = (val: number | string | undefined) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(num);
  };

  // Format ngày giờ Việt Nam
  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return "Chưa xác định";
    const d = new Date(dateStr);
    return d.toLocaleString("vi-VN", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Tính thời gian còn lại đến suất chiếu (phút)
  const getMinutesUntilShowtime = (startTimeStr?: string) => {
    if (!startTimeStr) return -9999;
    const start = new Date(startTimeStr).getTime();
    return Math.floor((start - now) / (1000 * 60));
  };

  // Kiểm tra điều kiện hủy vé theo BR-01 & BR-02
  const checkCancellationEligibility = (booking: BookingDetail) => {
    const minutesLeft = getMinutesUntilShowtime(booking.showtime?.startTime);
    const isConfirmed = booking.status === "CONFIRMED";
    const canCancel = isConfirmed && minutesLeft >= 60;
    return { canCancel, minutesLeft };
  };

  // Sao chép mã đặt chỗ
  const copyBookingCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  // Lọc theo Tab
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (activeTab === "ALL") return true;
      if (activeTab === "CONFIRMED") return b.status === "CONFIRMED";
      if (activeTab === "CANCELLED") return b.status === "CANCELLED" || b.status === "EXPIRED";
      if (activeTab === "PENDING") return b.status === "PENDING";
      return true;
    });
  }, [bookings, activeTab]);

  return (
    <div
      style={{
        background: "linear-gradient(180deg, #090a0f 0%, #111218 100%)",
        minHeight: "100vh",
        color: "#f4f4f5",
        padding: "40px 20px 80px 20px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ maxWidth: "1140px", margin: "0 auto" }}>
        {/* Toast thông báo */}
        {toast && (
          <div
            style={{
              position: "fixed",
              top: "24px",
              right: "24px",
              zIndex: 9999,
              background: toast.type === "success" ? "#064e3b" : "#7f1d1d",
              border: `1px solid ${toast.type === "success" ? "#10b981" : "#ef4444"}`,
              color: "#ffffff",
              padding: "14px 20px",
              borderRadius: "12px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontSize: "14px",
              fontWeight: "600",
            }}
          >
            <span>{toast.type === "success" ? "✅" : "⚠️"}</span>
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              style={{
                background: "transparent",
                border: "none",
                color: "#fff",
                cursor: "pointer",
                marginLeft: "8px",
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Header Banner */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "20px",
            marginBottom: "36px",
            paddingBottom: "24px",
            borderBottom: "1px solid #27272a",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "4px 10px",
                  background: "rgba(236, 72, 153, 0.15)",
                  color: "#f472b6",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: "800",
                  letterSpacing: "0.5px",
                }}
              >
                UC-09: MY BOOKINGS & REFUND
              </span>
              <span style={{ color: "#71717a", fontSize: "12px" }}>• Hệ Thống Vé Điện Tử</span>
            </div>
            <h1
              style={{
                fontSize: "32px",
                fontWeight: "900",
                margin: "0 0 8px 0",
                color: "#ffffff",
                letterSpacing: "-0.02em",
              }}
            >
              🎟️ Quản Lý Vé & Lịch Sử Đặt Chỗ
            </h1>
            <p style={{ color: "#a1a1aa", fontSize: "15px", margin: 0, maxWidth: "680px" }}>
              Tra cứu danh sách cuống vé điện tử, kiểm tra phòng chiếu, số ghế và thực hiện yêu cầu
              hủy vé hoàn tiền 100% tự động theo quy định (trước giờ chiếu tối thiểu 60 phút).
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <Link
              href="/movies"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 18px",
                background: "#e50914",
                color: "#ffffff",
                borderRadius: "10px",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: "700",
                boxShadow: "0 4px 14px rgba(229, 9, 20, 0.35)",
              }}
            >
              🎬 Đặt thêm vé mới ↗
            </Link>

            {isAdmin() && (
              <Link
                href="/admin/tickets"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "10px 16px",
                  background: "#18181b",
                  border: "1px solid #3f3f46",
                  color: "#d4d4d8",
                  borderRadius: "10px",
                  textDecoration: "none",
                  fontSize: "13px",
                  fontWeight: "600",
                }}
              >
                ⚙️ Admin Tra Cứu Vé
              </Link>
            )}
          </div>
        </div>

        {/* Chính sách hoàn hủy thông báo nổi bật (Business Rules) */}
        <div
          style={{
            background: "rgba(30, 27, 75, 0.4)",
            border: "1px solid rgba(129, 140, 248, 0.3)",
            borderRadius: "14px",
            padding: "16px 20px",
            marginBottom: "28px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: "28px" }}>💡</span>
          <div style={{ flex: 1, minWidth: "260px" }}>
            <h4 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: "700", color: "#c7d2fe" }}>
              Chính sách hủy vé & hoàn tiền tự động (BR-01 & BR-02)
            </h4>
            <p style={{ margin: 0, fontSize: "13px", color: "#a5b4fc", lineHeight: "1.5" }}>
              • Vé đang ở trạng thái <strong>Đã xác nhận</strong> và thời gian đến suất chiếu còn{" "}
              <strong>trên 60 phút</strong> được hủy vé và hoàn tiền 100% tự động về phương thức thanh toán ban đầu.
              <br />• Không áp dụng hoàn hủy đối với các suất chiếu còn dưới 60 phút hoặc phim đã bắt đầu.
            </p>
          </div>
        </div>

        {/* Thanh Bộ Lọc Trạng Thái */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            marginBottom: "24px",
            borderBottom: "1px solid #27272a",
            paddingBottom: "12px",
            flexWrap: "wrap",
          }}
        >
          {(
            [
              { id: "ALL", label: "Tất cả giao dịch", count: bookings.length },
              {
                id: "CONFIRMED",
                label: "Vé hợp lệ (Có thể đi xem)",
                count: bookings.filter((b) => b.status === "CONFIRMED").length,
              },
              {
                id: "CANCELLED",
                label: "Đã hủy / Hoàn tiền",
                count: bookings.filter((b) => b.status === "CANCELLED" || b.status === "EXPIRED").length,
              },
              {
                id: "PENDING",
                label: "Chờ xử lý",
                count: bookings.filter((b) => b.status === "PENDING").length,
              },
            ] as const
          ).map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 16px",
                  borderRadius: "20px",
                  fontSize: "13px",
                  fontWeight: isActive ? "700" : "500",
                  cursor: "pointer",
                  border: isActive ? "1px solid #e50914" : "1px solid #27272a",
                  background: isActive ? "#e50914" : "#18181b",
                  color: isActive ? "#ffffff" : "#a1a1aa",
                  transition: "all 0.2s ease",
                }}
              >
                <span>{tab.label}</span>
                <span
                  style={{
                    background: isActive ? "rgba(255,255,255,0.25)" : "#27272a",
                    color: isActive ? "#fff" : "#71717a",
                    padding: "1px 6px",
                    borderRadius: "10px",
                    fontSize: "11px",
                  }}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Nội dung danh sách vé */}
        {isLoading ? (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                border: "4px solid rgba(255,255,255,0.1)",
                borderTopColor: "#e50914",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
                margin: "0 auto 16px auto",
              }}
            />
            <p style={{ color: "#a1a1aa" }}>Đang tải danh sách vé của bạn...</p>
          </div>
        ) : isError ? (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              background: "#18181b",
              borderRadius: "16px",
              border: "1px solid #3f3f46",
            }}
          >
            <p style={{ color: "#ef4444", fontWeight: "600", fontSize: "16px", marginBottom: "12px" }}>
              ⚠️ Không thể tải danh sách vé: {readApiError(error)}
            </p>
            <button
              onClick={() => refetch()}
              style={{
                padding: "8px 20px",
                background: "#27272a",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              Thử lại ↻
            </button>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div
            style={{
              padding: "60px 20px",
              textAlign: "center",
              background: "#14151b",
              borderRadius: "16px",
              border: "1px dashed #27272a",
            }}
          >
            <span style={{ fontSize: "50px", display: "block", marginBottom: "16px" }}>🎟️</span>
            <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#f4f4f5", margin: "0 0 8px 0" }}>
              Không có vé nào trong mục này
            </h3>
            <p style={{ color: "#71717a", fontSize: "14px", margin: "0 0 20px 0" }}>
              Bạn chưa có đơn đặt vé nào khớp với bộ lọc hiện tại.
            </p>
            <Link
              href="/movies"
              style={{
                display: "inline-block",
                padding: "10px 24px",
                background: "#e50914",
                color: "#fff",
                borderRadius: "10px",
                textDecoration: "none",
                fontWeight: "700",
                fontSize: "14px",
              }}
            >
              Khám phá phim đang chiếu ngay
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {filteredBookings.map((booking) => {
              const { canCancel, minutesLeft } = checkCancellationEligibility(booking);
              const movie = booking.showtime?.movie;
              const room = booking.showtime?.room;
              const cinema = room?.cinema;
              const tickets = booking.tickets || [];
              const seatNames = tickets
                .map((t) => t.seat?.seatNumber || `Ghế #${t.seatId}`)
                .filter(Boolean)
                .join(", ");

              // Trạng thái vé styling
              const isConfirmed = booking.status === "CONFIRMED";
              const isCancelled = booking.status === "CANCELLED";
              const isExpired = booking.status === "EXPIRED";
              const isPending = booking.status === "PENDING";

              return (
                <div
                  key={booking.id}
                  style={{
                    background: "#16171f",
                    border: isConfirmed ? "1px solid #272738" : "1px solid #22232c",
                    borderRadius: "16px",
                    overflow: "hidden",
                    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)",
                    transition: "transform 0.15s ease, border-color 0.15s ease",
                  }}
                >
                  {/* Top Bar của Card */}
                  <div
                    style={{
                      background: "#1b1c26",
                      padding: "12px 20px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      borderBottom: "1px solid #252636",
                      flexWrap: "wrap",
                      gap: "10px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "12px", color: "#a1a1aa" }}>Mã đặt chỗ:</span>
                      <strong
                        style={{
                          fontSize: "14px",
                          letterSpacing: "0.5px",
                          color: "#38bdf8",
                          fontFamily: "monospace",
                        }}
                      >
                        {booking.bookingCode}
                      </strong>
                      <button
                        onClick={() => copyBookingCode(booking.bookingCode)}
                        title="Sao chép mã"
                        style={{
                          background: "transparent",
                          border: "none",
                          color: copiedCode === booking.bookingCode ? "#10b981" : "#71717a",
                          cursor: "pointer",
                          fontSize: "12px",
                          padding: "2px 6px",
                          borderRadius: "4px",
                        }}
                      >
                        {copiedCode === booking.bookingCode ? "✓ Đã chép" : "📋 Chép"}
                      </button>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ fontSize: "12px", color: "#71717a" }}>
                        Đặt lúc: {formatDateTime(booking.createdAt)}
                      </span>

                      {/* Trạng thái Badge */}
                      {isConfirmed && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "4px 10px",
                            background: "rgba(16, 185, 129, 0.15)",
                            color: "#34d399",
                            borderRadius: "20px",
                            fontSize: "12px",
                            fontWeight: "700",
                            border: "1px solid rgba(16, 185, 129, 0.3)",
                          }}
                        >
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981" }} />
                          Vé hợp lệ
                        </span>
                      )}
                      {isCancelled && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "4px 10px",
                            background: "rgba(239, 68, 68, 0.15)",
                            color: "#f87171",
                            borderRadius: "20px",
                            fontSize: "12px",
                            fontWeight: "700",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                          }}
                        >
                          ✕ Đã hủy & Hoàn tiền
                        </span>
                      )}
                      {isExpired && (
                        <span
                          style={{
                            padding: "4px 10px",
                            background: "#27272a",
                            color: "#a1a1aa",
                            borderRadius: "20px",
                            fontSize: "12px",
                            fontWeight: "600",
                          }}
                        >
                          Đã hết hạn
                        </span>
                      )}
                      {isPending && (
                        <span
                          style={{
                            padding: "4px 10px",
                            background: "rgba(245, 158, 11, 0.15)",
                            color: "#fbbf24",
                            borderRadius: "20px",
                            fontSize: "12px",
                            fontWeight: "700",
                            border: "1px solid rgba(245, 158, 11, 0.3)",
                          }}
                        >
                          ⏳ Chờ thanh toán
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body của Card: Thiết kế kiểu Cuống Vé Cinema */}
                  <div
                    style={{
                      padding: "20px",
                      display: "grid",
                      gridTemplateColumns: "100px 1fr auto",
                      gap: "24px",
                      alignItems: "center",
                    }}
                  >
                    {/* Poster phim */}
                    <div
                      style={{
                        width: "100px",
                        height: "140px",
                        borderRadius: "10px",
                        overflow: "hidden",
                        background: "#27272a",
                        position: "relative",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                      }}
                    >
                      {movie?.posterUrl ? (
                        <Image unoptimized width={200} height={300}
                          src={movie.posterUrl}
                          alt={movie.title || "Movie Poster"}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "36px",
                            background: "linear-gradient(135deg, #1f2937 0%, #111827 100%)",
                          }}
                        >
                          🎬
                        </div>
                      )}
                      {movie?.ageRating && (
                        <span
                          style={{
                            position: "absolute",
                            top: "6px",
                            left: "6px",
                            background: "#e50914",
                            color: "#fff",
                            fontSize: "10px",
                            fontWeight: "800",
                            padding: "2px 6px",
                            borderRadius: "4px",
                          }}
                        >
                          {movie.ageRating}
                        </span>
                      )}
                    </div>

                    {/* Chi tiết phim & suất chiếu */}
                    <div>
                      <h3
                        style={{
                          fontSize: "20px",
                          fontWeight: "800",
                          margin: "0 0 8px 0",
                          color: "#ffffff",
                        }}
                      >
                        {movie?.title || "Thông tin phim"}
                      </h3>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginBottom: "12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", color: "#e4e4e7" }}>
                          <span>🏢</span>
                          <strong>{cinema?.name || "Rạp CineBook"}</strong>
                          <span style={{ color: "#71717a" }}>({room?.roomName || "Phòng Standard"})</span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", color: "#facc15" }}>
                          <span>📅</span>
                          <strong>{formatDateTime(booking.showtime?.startTime)}</strong>
                        </div>
                      </div>

                      {/* Ghế đã đặt */}
                      <div
                        style={{
                          background: "#1f202c",
                          padding: "8px 14px",
                          borderRadius: "8px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "10px",
                          marginBottom: "8px",
                          border: "1px solid #2d2e3f",
                        }}
                      >
                        <span style={{ fontSize: "12px", color: "#a1a1aa" }}>Vị trí ghế ({tickets.length} vé):</span>
                        <span style={{ fontSize: "14px", fontWeight: "800", color: "#10b981", letterSpacing: "0.5px" }}>
                          {seatNames || "Chưa chọn ghế"}
                        </span>
                      </div>

                      {/* Thông tin đếm ngược suất chiếu & Điều kiện hủy vé */}
                      {isConfirmed && (
                        <div style={{ fontSize: "12px", marginTop: "4px" }}>
                          {minutesLeft > 0 ? (
                            <span style={{ color: canCancel ? "#38bdf8" : "#f59e0b" }}>
                              ⏱️ Còn <strong>{Math.floor(minutesLeft / 60)} giờ {minutesLeft % 60} phút</strong> nữa tới giờ chiếu.
                              {canCancel ? " (Đủ điều kiện hoàn hủy 100%)" : " (Dưới 60 phút - Không thể hủy)"}
                            </span>
                          ) : (
                            <span style={{ color: "#71717a" }}>Suất chiếu đã diễn ra.</span>
                          )}
                        </div>
                      )}

                      {isCancelled && booking.cancelledAt && (
                        <div style={{ fontSize: "12px", color: "#f87171", marginTop: "4px" }}>
                          Đã hoàn tất thủ tục hoàn tiền lúc {formatDateTime(booking.cancelledAt)}
                        </div>
                      )}
                    </div>

                    {/* Cột giá tiền & Thao tác hành động */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                        gap: "10px",
                        minWidth: "180px",
                        borderLeft: "1px dashed #272738",
                        paddingLeft: "20px",
                      }}
                    >
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: "12px", color: "#a1a1aa" }}>Tổng thanh toán:</span>
                        <div style={{ fontSize: "22px", fontWeight: "900", color: "#f43f5e" }}>
                          {formatCurrency(booking.totalAmount)}
                        </div>
                        <span style={{ fontSize: "11px", color: "#71717a" }}>
                          {booking.payments?.[0]?.method || "STRIPE"} • {booking.payments?.[0]?.status || "PAID"}
                        </span>
                      </div>

                      {/* Nút Xem Chi Tiết Cuống Vé */}
                      <button
                        onClick={() => setSelectedBookingForDetail(booking)}
                        style={{
                          width: "100%",
                          padding: "8px 14px",
                          background: "#27272a",
                          color: "#f4f4f5",
                          border: "1px solid #3f3f46",
                          borderRadius: "8px",
                          fontSize: "13px",
                          fontWeight: "600",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                          transition: "all 0.15s ease",
                        }}
                      >
                        🔍 Cuống vé chi tiết
                      </button>

                      {/* Nút Thanh toán ngay nếu trạng thái PENDING */}
                      {isPending && (
                        <button
                          onClick={() => payMutation.mutate(booking.bookingCode)}
                          disabled={payMutation.isPending}
                          style={{
                            width: "100%",
                            padding: "8px 14px",
                            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                            color: "#ffffff",
                            border: "1px solid #10b981",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: "700",
                            cursor: payMutation.isPending ? "not-allowed" : "pointer",
                            boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)",
                            transition: "all 0.15s ease",
                          }}
                        >
                          {payMutation.isPending ? "⏳ Đang xử lý..." : "💳 Thanh toán ngay (Mock)"}
                        </button>
                      )}


                      {/* Nút Hủy vé & Hoàn tiền (theo BR-01) */}
                      {isConfirmed && (
                        <button
                          onClick={() => setBookingToCancel(booking)}
                          disabled={!canCancel}
                          title={
                            canCancel
                              ? "Yêu cầu hủy vé và nhận hoàn tiền 100%"
                              : "Quy định rạp: Chỉ được hủy vé trước giờ chiếu ít nhất 60 phút"
                          }
                          style={{
                            width: "100%",
                            padding: "8px 14px",
                            background: canCancel ? "linear-gradient(135deg, #b91c1c 0%, #dc2626 100%)" : "#222227",
                            color: canCancel ? "#ffffff" : "#666670",
                            border: canCancel ? "1px solid #ef4444" : "1px solid #33333d",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: "700",
                            cursor: canCancel ? "pointer" : "not-allowed",
                            opacity: canCancel ? 1 : 0.6,
                            transition: "all 0.15s ease",
                          }}
                        >
                          {canCancel ? "✕ Hủy vé & Hoàn tiền" : "Không thể hủy (< 60p)"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* MODAL 1: XEM CHI TIẾT CUỐNG VÉ ĐIỆN TỬ (TICKET STUB) */}
        {selectedBookingForDetail && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.85)",
              backdropFilter: "blur(8px)",
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
            }}
          >
            <div
              style={{
                background: "#181822",
                border: "1px solid #2e2f42",
                borderRadius: "20px",
                width: "100%",
                maxWidth: "600px",
                maxHeight: "90vh",
                overflowY: "auto",
                boxShadow: "0 25px 60px rgba(0,0,0,0.8)",
                position: "relative",
              }}
            >
              {/* Modal Header */}
              <div
                style={{
                  padding: "20px",
                  borderBottom: "1px solid #27273a",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "#fff" }}>
                    🎟️ Cuống Vé Điện Tử CineBook
                  </h3>
                  <span style={{ fontSize: "12px", color: "#a1a1aa" }}>
                    Mã đơn: {selectedBookingForDetail.bookingCode}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedBookingForDetail(null)}
                  style={{
                    background: "#27273a",
                    border: "none",
                    color: "#fff",
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Modal Body: Ticket Mockup */}
              <div style={{ padding: "24px" }}>
                <div
                  style={{
                    background: "linear-gradient(135deg, #1e1f2f 0%, #171825 100%)",
                    border: "2px dashed #3b3d58",
                    borderRadius: "16px",
                    padding: "20px",
                    marginBottom: "20px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                    <div>
                      <span style={{ fontSize: "11px", fontWeight: "800", color: "#e50914", letterSpacing: "1px" }}>
                        CINEBOOK CINEMAS
                      </span>
                      <h2 style={{ fontSize: "22px", fontWeight: "900", margin: "4px 0", color: "#ffffff" }}>
                        {selectedBookingForDetail.showtime?.movie?.title || "Phim Chiếu Rạp"}
                      </h2>
                      <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af" }}>
                        {selectedBookingForDetail.showtime?.room?.cinema?.name} • {selectedBookingForDetail.showtime?.room?.roomName}
                      </p>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <span
                        style={{
                          padding: "4px 8px",
                          borderRadius: "6px",
                          background: selectedBookingForDetail.status === "CONFIRMED" ? "#065f46" : "#7f1d1d",
                          color: "#fff",
                          fontSize: "11px",
                          fontWeight: "700",
                        }}
                      >
                        {selectedBookingForDetail.status}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "12px",
                      background: "#12131d",
                      padding: "14px",
                      borderRadius: "10px",
                      marginBottom: "16px",
                      fontSize: "13px",
                    }}
                  >
                    <div>
                      <span style={{ color: "#71717a", display: "block", fontSize: "11px" }}>GIỜ CHIẾU:</span>
                      <strong style={{ color: "#facc15" }}>
                        {formatDateTime(selectedBookingForDetail.showtime?.startTime)}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: "#71717a", display: "block", fontSize: "11px" }}>TỔNG TIỀN:</span>
                      <strong style={{ color: "#f43f5e" }}>
                        {formatCurrency(selectedBookingForDetail.totalAmount)}
                      </strong>
                    </div>
                  </div>

                  {/* Danh sách từng vé con trong đơn */}
                  <div style={{ marginBottom: "16px" }}>
                    <span style={{ fontSize: "12px", fontWeight: "700", color: "#a1a1aa", display: "block", marginBottom: "8px" }}>
                      DANH SÁCH CUỐNG VÉ CHI TIẾT:
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {(selectedBookingForDetail.tickets || []).map((ticket: BookingTicket, index: number) => (
                        <div
                          key={ticket.id || index}
                          style={{
                            background: "#161724",
                            border: "1px solid #27283c",
                            padding: "10px 14px",
                            borderRadius: "8px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: "700", color: "#10b981", fontSize: "14px", marginRight: "10px" }}>
                              Ghế {ticket.seat?.seatNumber || `#${ticket.seat?.id}`}
                            </span>
                            <span style={{ fontSize: "11px", color: "#818cf8" }}>
                              ({ticket.seat?.type || "STANDARD"})
                            </span>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <code style={{ fontSize: "11px", color: "#38bdf8", background: "#0f1019", padding: "2px 6px", borderRadius: "4px" }}>
                              {ticket.ticketCode}
                            </code>
                            <span
                              style={{
                                marginLeft: "8px",
                                fontSize: "11px",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                background: ticket.status === "VALID" || ticket.status === "CONFIRMED" ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                                color: ticket.status === "VALID" || ticket.status === "CONFIRMED" ? "#34d399" : "#f87171",
                              }}
                            >
                              {ticket.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Mã vạch mô phỏng kiểm soát vào cửa */}
                  <div
                    style={{
                      textAlign: "center",
                      paddingTop: "14px",
                      borderTop: "1px dashed #33354a",
                    }}
                  >
                    <div
                      style={{
                        height: "40px",
                        background:
                          "repeating-linear-gradient(90deg, #fff 0px, #fff 2px, transparent 2px, transparent 6px, #fff 6px, #fff 10px)",
                        margin: "0 auto 8px auto",
                        maxWidth: "280px",
                      }}
                    />
                    <span style={{ fontSize: "11px", letterSpacing: "2px", color: "#a1a1aa", fontFamily: "monospace" }}>
                      * {selectedBookingForDetail.bookingCode} *
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedBookingForDetail(null)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: "#27273a",
                    color: "#fff",
                    border: "none",
                    borderRadius: "10px",
                    fontWeight: "700",
                    cursor: "pointer",
                  }}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 2: XÁC NHẬN HỦY VÉ & HOÀN TIỀN */}
        {bookingToCancel && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.85)",
              backdropFilter: "blur(8px)",
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
            }}
          >
            <div
              style={{
                background: "#181822",
                border: "1px solid #dc2626",
                borderRadius: "20px",
                width: "100%",
                maxWidth: "520px",
                padding: "24px",
                boxShadow: "0 25px 60px rgba(220, 38, 38, 0.25)",
              }}
            >
              <div style={{ textAlign: "center", marginBottom: "20px" }}>
                <span style={{ fontSize: "44px", display: "block", marginBottom: "10px" }}>⚠️</span>
                <h3 style={{ margin: "0 0 6px 0", fontSize: "20px", fontWeight: "900", color: "#ffffff" }}>
                  Xác Nhận Hủy Vé & Hoàn Tiền
                </h3>
                <p style={{ margin: 0, fontSize: "13px", color: "#a1a1aa" }}>
                  Mã đơn đặt vé: <strong style={{ color: "#38bdf8" }}>{bookingToCancel.bookingCode}</strong>
                </p>
              </div>

              <div
                style={{
                  background: "#12131d",
                  border: "1px solid #27283c",
                  padding: "16px",
                  borderRadius: "12px",
                  marginBottom: "20px",
                  fontSize: "13px",
                  lineHeight: "1.6",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ color: "#71717a" }}>Phim:</span>
                  <strong style={{ color: "#fff" }}>{bookingToCancel.showtime?.movie?.title}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ color: "#71717a" }}>Suất chiếu:</span>
                  <span style={{ color: "#facc15" }}>{formatDateTime(bookingToCancel.showtime?.startTime)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ color: "#71717a" }}>Số vé hủy:</span>
                  <strong style={{ color: "#10b981" }}>{bookingToCancel.tickets?.length || 0} vé</strong>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    paddingTop: "8px",
                    borderTop: "1px solid #27283c",
                  }}
                >
                  <span style={{ color: "#71717a" }}>Số tiền hoàn lại (100%):</span>
                  <strong style={{ color: "#f43f5e", fontSize: "16px" }}>
                    {formatCurrency(bookingToCancel.totalAmount)}
                  </strong>
                </div>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#a1a1aa", marginBottom: "6px" }}>
                  Lý do hủy vé (tùy chọn):
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Bận đột xuất, thay đổi lịch trình..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: "#12131d",
                    border: "1px solid #2e2f42",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setBookingToCancel(null)}
                  disabled={cancelMutation.isPending}
                  style={{
                    flex: 1,
                    padding: "12px",
                    background: "#27273a",
                    color: "#d4d4d8",
                    border: "none",
                    borderRadius: "10px",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  Giữ lại vé
                </button>
                <button
                  type="button"
                  onClick={() => cancelMutation.mutate(bookingToCancel.bookingCode)}
                  disabled={cancelMutation.isPending}
                  style={{
                    flex: 1,
                    padding: "12px",
                    background: "#dc2626",
                    color: "#fff",
                    border: "none",
                    borderRadius: "10px",
                    fontWeight: "700",
                    cursor: cancelMutation.isPending ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  {cancelMutation.isPending ? "Đang xử lý hoàn tiền..." : "Đồng ý Hủy & Hoàn tiền"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
