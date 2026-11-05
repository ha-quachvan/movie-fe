"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { readApiError } from "@/lib/api";
import { useProfile } from "@/hooks/useProfile";
import { useAccessToken, useClientReady } from "@/hooks/useClientState";
export default function ProfilePage() {
  const router = useRouter();
  const ready = useClientReady();
  const token = useAccessToken();
  const { data: profile, isLoading, error, refetch } = useProfile();
  useEffect(() => {
    if (ready && !token) router.replace("/login?redirect=/profile");
  }, [ready, token, router]);
  if (!ready || !token || isLoading) return <p className="p-10">Đang tải thông tin tài khoản...</p>;
  if (error || !profile) return <div className="p-10"><p role="alert">{readApiError(error, "Không thể tải thông tin tài khoản.")}</p><button onClick={() => void refetch()}>Thử lại</button></div>;
  const details = [
    ["Họ và tên", profile.fullName || profile.full_name],
    ["Email", profile.email],
    ["Số điện thoại", profile.phoneNumber || profile.phone_number],
    ["Vai trò", profile.role === "ADMIN" ? "Quản trị viên" : profile.role === "STAFF" ? "Nhân viên" : "Khách hàng"],
    ["Tham gia từ", profile.createdAt ? new Date(profile.createdAt).toLocaleDateString("vi-VN") : undefined],
  ];
  return <section className="mx-auto max-w-3xl px-4 py-10">
    <h1 className="mb-6 text-2xl font-bold">Thông tin cá nhân</h1>
    <dl className="divide-y divide-[#e8e6df] overflow-hidden rounded-3xl border border-[#e8e6df] bg-white">
      {details.map(([label, value]) => <div key={label} className="flex justify-between gap-4 px-6 py-4"><dt className="text-[#6b6b66]">{label}</dt><dd className="text-right font-medium">{value || "Chưa cập nhật"}</dd></div>)}
    </dl>
  </section>;
}
