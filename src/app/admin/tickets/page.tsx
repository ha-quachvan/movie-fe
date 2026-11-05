"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import AdminNav from "@/components/admin/AdminNav";
import {
  getBookingDetail,
  cancelAndRefundTicket,
  readApiError,
} from "@/lib/api";

export default function AdminTicketsPage() {
  const [searchBookingCode, setSearchBookingCode] = useState("");
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  // Tra cứu chi tiết vé theo bookingCode
  const {
    data: booking,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["admin-booking-detail", activeCode],
    queryFn: () => (activeCode ? getBookingDetail(activeCode) : Promise.reject("Chưa nhập mã")),
    enabled: !!activeCode,
    retry: false,
  });

  // Mutation hủy vé admin
  const cancelMutation = useMutation({
    mutationFn: (code: string) => cancelAndRefundTicket(code),
    onSuccess: (data) => {
      setToast({
        message: `Đã hủy vé ${data.bookingCode} thành công và kích hoạt hoàn tiền!`,
        type: "success",
      });
      setConfirmCancel(false);
      refetch();
    },
    onError: (err) => {
      setToast({
        message: readApiError(err, "Không thể hủy vé."),
        type: "error",
      });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchBookingCode.trim()) {
      setActiveCode(searchBookingCode.trim());
    }
  };

  const formatCurrency = (val: number | string | undefined) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(num);
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleString("vi-VN");
  };

  return (
    <div
      style={{
        background: "#090a0f",
        minHeight: "100vh",
        color: "#f4f4f5",
        padding: "24px 20px 80px 20px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ maxWidth: "1140px", margin: "0 auto" }}>
        {/* Navigation Admin Bar */}
        <AdminNav />

        {/* Toast */}
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
              fontSize: "14px",
              fontWeight: "600",
            }}
          >
            <span>{toast.type === "success" ? "✅" : "⚠️"} {toast.message}</span>
            <button
              onClick={() => setToast(null)}
              style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", marginLeft: "10px" }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Tiêu đề trang */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <span
              style={{
                fontSize: "12px",
                fontWeight: "800",
                color: "#ec4899",
                background: "rgba(236,72,153,0.15)",
                padding: "3px 8px",
                borderRadius: "6px",
              }}
            >
              UC-09 (ADMIN LOOKUP)
            </span>
            <span style={{ color: "#71717a", fontSize: "12px" }}>• Quản trị hệ thống vé</span>
          </div>
          <h1 style={{ fontSize: "28px", fontWeight: "900", margin: "0 0 6px 0", color: "#ffffff" }}>
            🎟️ Tra Cứu & Quản Lý Cuống Vé (Admin)
          </h1>
          <p style={{ color: "#a1a1aa", fontSize: "14px", margin: 0 }}>
            Tra cứu thông tin vé, ghế ngồi, phương thức thanh toán và kiểm tra tính hợp lệ của bất kỳ mã đặt chỗ nào trên toàn hệ thống.
          </p>
        </div>

        {/* Search Bar */}
        <div
          style={{
            background: "#161722",
            border: "1px solid #27283c",
            borderRadius: "16px",
            padding: "24px",
            marginBottom: "32px",
          }}
        >
          <form onSubmit={handleSearch} style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "260px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#a1a1aa", marginBottom: "8px" }}>
                Nhập Mã Đặt Chỗ (Booking Code):
              </label>
              <input
                type="text"
                placeholder="Ví dụ: BK-1728901234-A1B2 hoặc dán mã vé..."
                value={searchBookingCode}
                onChange={(e) => setSearchBookingCode(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: "#0e0f17",
                  border: "1px solid #32344d",
                  borderRadius: "10px",
                  color: "#fff",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
            </div>
            <div style={{ alignSelf: "flex-end" }}>
              <button
                type="submit"
                style={{
                  padding: "12px 24px",
                  background: "#ec4899",
                  color: "#fff",
                  border: "none",
                  borderRadius: "10px",
                  fontWeight: "700",
                  fontSize: "14px",
                  cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(236,72,153,0.35)",
                }}
              >
                🔍 Tra Cứu Vé
              </button>
            </div>
          </form>

          {/* Gợi ý test nhanh */}
          <div style={{ marginTop: "16px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "12px", color: "#71717a" }}>Mẹo:</span>
            <span style={{ fontSize: "12px", color: "#a1a1aa" }}>
              Khách hàng có thể cung cấp mã đặt chỗ từ ứng dụng di động hoặc email biên lai.
            </span>
          </div>
        </div>

        {/* Kết quả hiển thị */}
        {isLoading ? (
          <div style={{ textAlign: "center", padding: "60px" }}>
            <p style={{ color: "#a1a1aa" }}>Đang truy vấn cơ sở dữ liệu MySQL...</p>
          </div>
        ) : isError ? (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              background: "#161722",
              borderRadius: "16px",
              border: "1px solid #ef4444",
            }}
          >
            <p style={{ color: "#ef4444", fontWeight: "700", fontSize: "16px", marginBottom: "6px" }}>
              Không tìm thấy đơn đặt vé với mã &quot;{activeCode}&quot;
            </p>
            <p style={{ color: "#a1a1aa", fontSize: "13px" }}>
              Vui lòng kiểm tra lại tính chính xác của mã đặt chỗ hoặc phân quyền truy cập.
            </p>
          </div>
        ) : booking ? (
          <div
            style={{
              background: "#161722",
              border: "1px solid #27283c",
              borderRadius: "16px",
              overflow: "hidden",
            }}
          >
            {/* Header của Ticket */}
            <div
              style={{
                background: "#1b1c2b",
                padding: "16px 24px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid #282a40",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div>
                <span style={{ fontSize: "12px", color: "#71717a" }}>Mã Booking: </span>
                <strong style={{ fontSize: "16px", color: "#38bdf8", fontFamily: "monospace" }}>
                  {booking.bookingCode}
                </strong>
                <span style={{ marginLeft: "12px", fontSize: "12px", color: "#a1a1aa" }}>
                  (ID đơn: #{booking.id} • User ID: #{booking.userId})
                </span>
              </div>

              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <span
                  style={{
                    padding: "4px 12px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: "800",
                    background: booking.status === "CONFIRMED" ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)",
                    color: booking.status === "CONFIRMED" ? "#34d399" : "#f87171",
                    border: `1px solid ${booking.status === "CONFIRMED" ? "#10b981" : "#ef4444"}`,
                  }}
                >
                  TRẠNG THÁI: {booking.status}
                </span>

                {booking.status === "CONFIRMED" && (
                  <button
                    onClick={() => setConfirmCancel(true)}
                    style={{
                      padding: "6px 12px",
                      background: "#b91c1c",
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "700",
                      cursor: "pointer",
                    }}
                  >
                    Hủy Vé Admin
                  </button>
                )}
              </div>
            </div>

            {/* Chi tiết nội dung vé */}
            <div style={{ padding: "24px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: "20px",
                  marginBottom: "24px",
                }}
              >
                {/* Khối 1: Thông tin Suất chiếu & Phim */}
                <div style={{ background: "#10111a", padding: "16px", borderRadius: "12px", border: "1px solid #232536" }}>
                  <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", color: "#818cf8", fontWeight: "700" }}>
                    🎬 THÔNG TIN PHIM & SUẤT CHIẾU
                  </h4>
                  <p style={{ margin: "0 0 6px 0", fontSize: "16px", fontWeight: "800", color: "#fff" }}>
                    {booking.showtime?.movie?.title || "Phim"}
                  </p>
                  <p style={{ margin: "0 0 6px 0", fontSize: "13px", color: "#a1a1aa" }}>
                    🏢 {booking.showtime?.room?.cinema?.name} - {booking.showtime?.room?.roomName}
                  </p>
                  <p style={{ margin: 0, fontSize: "13px", color: "#facc15" }}>
                    📅 Khởi chiếu: {formatDateTime(booking.showtime?.startTime)}
                  </p>
                </div>

                {/* Khối 2: Thông tin Thanh toán */}
                <div style={{ background: "#10111a", padding: "16px", borderRadius: "12px", border: "1px solid #232536" }}>
                  <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", color: "#818cf8", fontWeight: "700" }}>
                    💳 THÔNG TIN THANH TOÁN
                  </h4>
                  <p style={{ margin: "0 0 6px 0", fontSize: "18px", fontWeight: "900", color: "#f43f5e" }}>
                    Tổng tiền: {formatCurrency(booking.totalAmount)}
                  </p>
                  <p style={{ margin: "0 0 6px 0", fontSize: "13px", color: "#a1a1aa" }}>
                    Phương thức: <strong>{booking.payments?.[0]?.method || "STRIPE"}</strong>
                  </p>
                  <p style={{ margin: 0, fontSize: "13px", color: "#34d399" }}>
                    Trạng thái GD: {booking.payments?.[0]?.status || "PAID"}
                  </p>
                </div>
              </div>

              {/* Danh sách vé & ghế */}
              <h4 style={{ margin: "0 0 12px 0", fontSize: "15px", fontWeight: "800", color: "#fff" }}>
                💺 Danh Sách Ghế Ngồi & Vé Con ({booking.tickets?.length || 0} vé)
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
                {(booking.tickets || []).map((ticket) => (
                  <div
                    key={ticket.id}
                    style={{
                      background: "#12131d",
                      border: "1px solid #282a3e",
                      padding: "12px",
                      borderRadius: "10px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <span style={{ fontSize: "14px", fontWeight: "800", color: "#10b981" }}>
                        Ghế {ticket.seat?.seatNumber}
                      </span>
                      <span style={{ fontSize: "11px", color: "#818cf8" }}>{ticket.seat?.type || "REGULAR"}</span>
                    </div>
                    <div style={{ fontSize: "11px", color: "#71717a", fontFamily: "monospace", marginBottom: "4px" }}>
                      {ticket.ticketCode}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "12px", color: "#f43f5e", fontWeight: "700" }}>
                        {formatCurrency(ticket.price)}
                      </span>
                      <span
                        style={{
                          fontSize: "10px",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: ticket.status === "VALID" ? "#065f46" : "#7f1d1d",
                          color: "#fff",
                        }}
                      >
                        {ticket.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Confirm Cancel Modal */}
              {confirmCancel && (
                <div
                  style={{
                    marginTop: "20px",
                    background: "rgba(185,28,28,0.1)",
                    border: "1px solid #b91c1c",
                    padding: "16px",
                    borderRadius: "10px",
                  }}
                >
                  <p style={{ color: "#f87171", fontWeight: "700", margin: "0 0 10px 0" }}>
                    ⚠️ Bạn có chắc chắn muốn hủy đơn vé này với quyền Quản trị viên? Tiền sẽ được hoàn lại tự động.
                  </p>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      onClick={() => cancelMutation.mutate(booking.bookingCode)}
                      disabled={cancelMutation.isPending}
                      style={{
                        padding: "8px 16px",
                        background: "#dc2626",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        fontWeight: "700",
                        cursor: "pointer",
                      }}
                    >
                      {cancelMutation.isPending ? "Đang hủy..." : "Xác nhận Hủy Vé"}
                    </button>
                    <button
                      onClick={() => setConfirmCancel(false)}
                      style={{
                        padding: "8px 16px",
                        background: "#27273a",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                      }}
                    >
                      Bỏ qua
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: "60px 20px",
              textAlign: "center",
              background: "#14151f",
              borderRadius: "16px",
              border: "1px dashed #27283c",
            }}
          >
            <span style={{ fontSize: "40px", display: "block", marginBottom: "12px" }}>🔍</span>
            <p style={{ color: "#71717a", fontSize: "14px", margin: 0 }}>
              Nhập mã đặt chỗ ở khung tìm kiếm phía trên để tra cứu chi tiết cuống vé.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
