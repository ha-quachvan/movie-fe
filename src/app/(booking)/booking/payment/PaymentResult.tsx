"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { cinemaRequest } from "@/components/cinema/cinema-api";
import styles from "@/components/cinema/cinema.module.css";

type Result = { status: string; payments: { status: string }[] };
export default function PaymentResult() {
  const params = useSearchParams();
  const code = params.get("bookingCode") || "";
  const cancelled = params.get("cancelled") === "1";
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const result = useQuery({
    queryKey: ["stripe-payment", code], enabled: Boolean(code), retry: 1,
    queryFn: () => cinemaRequest<Result>(`/bookings/stripe/status/${encodeURIComponent(code)}`),
    refetchInterval: query => query.state.data?.status === "PENDING" && !cancelled ? 3000 : false,
  });
  const paid = result.data?.status === "CONFIRMED";
  const pending = result.data?.status === "PENDING";
  const refunded = result.data?.payments.some(p => p.status === "REFUNDED" || p.status === "REFUND_PENDING");
  async function retryCheckout() {
    setBusy(true); setError("");
    try {
      const checkout = await cinemaRequest<{ url: string }>("/bookings/stripe/checkout", { method: "POST", body: JSON.stringify({ bookingCode: code }) });
      window.location.assign(checkout.url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể mở Stripe"); setBusy(false); }
  }
  return <main className={styles.page}><section className={styles.container} style={{ padding: "64px 24px", maxWidth: 700 }}>
    <p className={styles.eyebrow}>STRIPE TEST MODE</p>
    <h1>{paid ? "Thanh toán thành công" : refunded ? "Giao dịch đang/đã được hoàn tiền" : cancelled ? "Bạn đã quay lại từ Stripe" : "Kiểm tra kết quả thanh toán"}</h1>
    <p>Mã đơn: {code || "Không có"}</p>
    <p>{paid ? "Vé đã được xác nhận. Bạn có thể xem vé trong lịch sử đặt vé." : refunded ? "Đơn không thể cấp vé hoặc đã bị hủy. Kiểm tra trạng thái hoàn tiền trong lịch sử vé." : pending ? "Đơn đang chờ thanh toán. Vui lòng hoàn tất trước khi hết hạn giữ ghế." : result.isLoading ? "Đang đối chiếu với Stripe..." : result.data ? "Đơn đã hết hạn hoặc đã bị hủy." : "Không thể xác nhận giao dịch."}</p>
    {(error || result.error) && <p role="alert" className={styles.error}>{error || (result.error instanceof Error ? result.error.message : "Lỗi kết nối")}</p>}
    {pending && <button type="button" className={styles.primary} disabled={busy} onClick={retryCheckout}>{busy ? "Đang mở Stripe..." : "Tiếp tục thanh toán"}</button>}
    <p><Link href="/my-tickets">Xem vé của tôi</Link> · <Link href="/movies">Chọn phim khác</Link></p>
    <button type="button" onClick={() => void result.refetch()}>Kiểm tra lại trạng thái</button>
  </section></main>;
}
