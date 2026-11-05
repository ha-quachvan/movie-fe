"use client";

import { useState } from "react";
import Link from "next/link";
import { readApiError } from "@/lib/api";
import { useLogin } from "@/hooks/useAuth";
import { useToast } from "@/components/Toast";
import AuthShell from "@/components/AuthShell";
import EyeIcon from "@/components/EyeIcon";

const fieldClass =
  "w-full rounded-xl border border-[#e0ddd3] bg-white px-4 py-3 text-[15px] text-[#1b1b19] outline-none transition-colors placeholder:text-[#b0aea6] focus:border-[#6b6b66] focus:ring-2 focus:ring-[#6b6b66]/10";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const loginMutation = useLogin();
  const toast = useToast();

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    loginMutation.mutate(
      { email, password },
      {
        onSuccess: () => {
          toast.success("Đăng nhập thành công", "Chào mừng trở lại!");
          // Dùng window.location.href để load lại toàn bộ trạng thái Auth chuẩn xác nhất
          const redirect = new URLSearchParams(window.location.search).get("redirect");
          const target = redirect ? new URL(redirect, window.location.origin) : null;
          window.location.assign(target?.origin === window.location.origin ? target.href : "/");
        },
        onError: (err) => toast.error("Đăng nhập thất bại", readApiError(err)),
      }
    );
  }

  return (
    <AuthShell
      title="Đăng nhập"
      subtitle="Quản lý rạp, phòng chiếu, suất chiếu và doanh thu của bạn."
      footer={
        <>
          Chưa có tài khoản?{" "}
          <Link
            href="/register"
            className="font-medium text-[#ef4444] underline-offset-2 hover:underline"
          >
            Đăng ký ngay
          </Link>
        </>
      }
    >
      <form onSubmit={handleLogin} className="mt-8 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-[#6b6b66]">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={fieldClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="password"
            className="text-sm font-medium text-[#6b6b66]"
          >
            Mật khẩu
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={`${fieldClass} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b6b66] hover:text-[#111827]"
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            >
              <EyeIcon open={showPassword} />
            </button>
          </div>
        </div>

        {loginMutation.isError && (
          <p
            role="alert"
            className="rounded-xl border border-[#e7c6b8] bg-[#f8ece6] px-4 py-3 text-sm text-[#a8503a]"
          >
            {readApiError(loginMutation.error)}
          </p>
        )}

        <button
          type="submit"
          disabled={loginMutation.isPending}
          className="mt-2 rounded-full bg-[#1b1b19] px-6 py-3.5 text-[15px] font-medium text-[#f7f6f1] transition-all hover:-translate-y-0.5 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {loginMutation.isPending ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>

        <Link
          href="/forgot-password"
          className="text-center text-sm font-medium text-[#6b6b66] underline-offset-2 hover:underline"
        >
          Quên mật khẩu?
        </Link>
      </form>
    </AuthShell>
  );
}