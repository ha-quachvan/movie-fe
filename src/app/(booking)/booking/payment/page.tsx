import { Suspense } from "react";
import PaymentResult from "./PaymentResult";
export default function PaymentPage() {
  return <Suspense fallback={<p>Đang tải kết quả thanh toán...</p>}><PaymentResult /></Suspense>;
}
