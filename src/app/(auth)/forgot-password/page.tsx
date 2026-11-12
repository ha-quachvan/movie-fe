"use client";

import { useState } from "react";
import Link from "next/link";
import { readApiError } from "@/lib/api";
import { useRequestPasswordReset, useResetPassword } from "@/hooks/useAuth";
import { useToast } from "@/components/Toast";
import AuthShell from "@/components/AuthShell";
import EyeIcon from "@/components/EyeIcon";

const fieldClass =
  "w-full rounded-xl border border-[#e0ddd3] bg-white px-4 py-3 text-[15px] text-[#1b1b19] outline-none transition-colors placeholder:text-[#b0aea6] focus:border-[#1b1b19] focus:ring-2 focus:ring-[#1b1b19]/10";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<"request" | "reset">("request");

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const requestReset = useRequestPasswordReset();
  const resetMutation = useResetPassword();
  const toast = useToast();

  function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    requestReset.mutate(
      { email },
      {
        onSuccess: (data) => {
          setStep("reset");
          toast.success("Đã yêu cầu mã khôi phục", data.delivery === "console" ? "Chế độ phát triển: kiểm tra log backend." : `Kiểm tra hộp thư ${email}.`);
        },
        onError: (err) => toast.error("Không gửi được mã", readApiError(err)),
      }
    );
  }

  function handleReset(e: React.FormEvent) {
    e.preventDefault();
    resetMutation.mutate(
      { email, otp: otp.trim(), newPassword },
      {
        onSuccess: () =>
          toast.success("Đổi mật khẩu thành công", "Vui lòng đăng nhập bằng mật khẩu mới."),
        onError: (err) => toast.error("Đặt lại mật khẩu thất bại", readApiError(err)),
      }
    );
  }

  const backToLogin = (
    <Link
      href="/login"
      className="font-medium text-[#6b6b66] underline-offset-2 hover:underline"
    >
      ← Quay lại đăng nhập
    </Link>
  );

  if (step === "reset") {
    return (
      <AuthShell
        title="Đặt lại mật khẩu"
        subtitle={
          <>
            {requestReset.data?.delivery === "console" ? "Chế độ phát triển: lấy mã từ log backend cho " : "Nhập mã đã gửi tới "}
            <strong className="font-medium text-[#1b1b19]">{email}</strong> và
            mật khẩu mới.
          </>
        }
        footer={backToLogin}
      >
        <form onSubmit={handleReset} className="mt-8 flex flex-col gap-4">
          {requestReset.isSuccess && (
            <p className="rounded-xl border border-[#cfe0d2] bg-[#eef4ef] px-4 py-3 text-sm text-[#4a6b50]">
              {requestReset.data?.delivery === "console" ? "Chế độ phát triển: xem mã trong log backend." : `Nếu email hợp lệ, mã khôi phục sẽ được gửi tới ${email}.`} Mã có hiệu lực 10 phút.
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="otp" className="text-sm font-medium text-[#1b1b19]">
              Mã khôi phục
            </label>
            <input
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="______"
              pattern="[0-9]{6}"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
              className={`${fieldClass} text-center text-2xl tracking-[0.5em]`}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="newPassword"
              className="text-sm font-medium text-[#1b1b19]"
            >
              Mật khẩu mới
            </label>
            <div className="relative">
              <input
                id="newPassword"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Tối thiểu 8 ký tự"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className={`${fieldClass} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b6b66] hover:text-[#1b1b19]"
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>

          {resetMutation.isError && (
            <p
              role="alert"
              className="rounded-xl border border-[#e7c6b8] bg-[#f8ece6] px-4 py-3 text-sm text-[#a8503a]"
            >
              {readApiError(resetMutation.error)}
            </p>
          )}

          <button
            type="submit"
            disabled={resetMutation.isPending}
            className="mt-2 rounded-full bg-[#1b1b19] px-6 py-3.5 text-[15px] font-medium text-[#f7f6f1] transition-all hover:-translate-y-0.5 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {resetMutation.isPending ? "Đang đặt lại..." : "Đặt lại mật khẩu"}
          </button>

          <button
            type="button"
            onClick={() =>
              requestReset.mutate(
                { email },
                {
                  onSuccess: () =>
                    toast.success("Đã gửi lại mã", `Kiểm tra hộp thư ${email}.`),
                  onError: (err) =>
                    toast.error("Không gửi được mã", readApiError(err)),
                }
              )
            }
            disabled={requestReset.isPending}
            className="text-sm text-[#6b6b66] underline-offset-2 hover:text-[#1b1b19] hover:underline disabled:opacity-60"
          >
            {requestReset.isPending ? "Đang gửi lại..." : "Chưa nhận được mã? Gửi lại"}
          </button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Quên mật khẩu"
      subtitle="Nhập email để nhận mã khôi phục mật khẩu."
      footer={backToLogin}
    >
      <form onSubmit={handleRequest} className="mt-8 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-[#6b6b66]">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="ban@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={fieldClass}
          />
        </div>

        {requestReset.isError && (
          <p
            role="alert"
            className="rounded-xl border border-[#e7c6b8] bg-[#f8ece6] px-4 py-3 text-sm text-[#a8503a]"
          >
            {readApiError(requestReset.error)}
          </p>
        )}

        <button
          type="submit"
          disabled={requestReset.isPending}
          className="mt-2 rounded-full bg-[#1b1b19] px-6 py-3.5 text-[15px] font-medium text-[#f7f6f1] transition-all hover:-translate-y-0.5 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {requestReset.isPending ? "Đang gửi..." : "Gửi mã khôi phục"}
        </button>
      </form>
    </AuthShell>
  );
}
