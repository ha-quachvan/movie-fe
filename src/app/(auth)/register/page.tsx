"use client";

import { useState } from "react";
import Link from "next/link";
import { readApiError } from "@/lib/api";
import { useRegister, useVerifyEmail, useResendVerification } from "@/hooks/useAuth";
import { useToast } from "@/components/Toast";
import AuthShell from "@/components/AuthShell";
import EyeIcon from "@/components/EyeIcon";

const fieldClass =
  "w-full rounded-xl border border-[#e0ddd3] bg-white px-4 py-3 text-[15px] text-[#1b1b19] outline-none transition-colors placeholder:text-[#b0aea6] focus:border-[#1b1b19] focus:ring-2 focus:ring-[#1b1b19]/10";

export default function RegisterPage() {
  const [step, setStep] = useState<"form" | "otp">("form");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [localError, setLocalError] = useState("");

  const registerMutation = useRegister();
  const verifyMutation = useVerifyEmail();
  const toast = useToast();
  const resend = useResendVerification();
  const consoleDelivery = registerMutation.data?.delivery === "console";

  function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLocalError("");

    if (password !== confirmPassword) {
      setLocalError("Mật khẩu xác nhận không trùng khớp!");
      return;
    }

    registerMutation.mutate(
      { email, fullName, password, phoneNumber: phoneNumber || undefined },
      {
        onSuccess: (data) => {
          setStep("otp");
          toast.success("Đã khởi tạo đăng ký", data.delivery === "console" ? "Chế độ phát triển: mã xác thực ở log backend." : "Vui lòng kiểm tra email để lấy mã xác thực.");
        },
        onError: (err) => toast.error("Đăng ký thất bại", readApiError(err)),
      }
    );
  }

  function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    verifyMutation.mutate(
      { email, otp: otp.trim() },
      { onError: (err) => toast.error("Xác thực thất bại", readApiError(err)) }
    );
  }

  if (step === "otp") {
    return (
      <AuthShell
        title="Xác thực email"
        subtitle={
          <>
            Nhập mã OTP đã tạo cho{" "}
            <strong className="font-medium text-[#1b1b19]">{email}</strong> {consoleDelivery ? "(chế độ phát triển: xem log backend)." : "(kiểm tra hộp thư email)."}
          </>
        }
        footer={
          <button
            type="button"
            onClick={() => {
              setStep("form");
              verifyMutation.reset();
            }}
            className="font-medium text-[#1b1b19] underline-offset-2 hover:underline"
          >
            ← Quay lại
          </button>
        }
      >
        <form onSubmit={handleVerify} className="mt-8 flex flex-col gap-4">
          <p className="rounded-xl border border-[#cfe0d2] bg-[#eef4ef] px-4 py-3 text-sm text-[#4a6b50]">
            {consoleDelivery ? "Chế độ phát triển: mã xác thực được ghi vào log backend." : "Mã xác thực đã được gửi tới email đăng ký."} Mã có hiệu lực 10 phút và chỉ dùng một lần.
          </p>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="otp" className="text-sm font-medium text-[#6b6b66]">
              Mã xác thực (OTP)
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

          {verifyMutation.isError && (
            <p
              role="alert"
              className="rounded-xl border border-[#e7c6b8] bg-[#f8ece6] px-4 py-3 text-sm text-[#a8503a]"
            >
              {readApiError(verifyMutation.error)}
            </p>
          )}

          <button
            type="submit"
            disabled={verifyMutation.isPending}
            className="mt-2 rounded-full bg-[#1b1b19] px-6 py-3.5 text-[15px] font-medium text-[#f7f6f1] transition-all hover:-translate-y-0.5 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {verifyMutation.isPending ? "Đang xác thực..." : "Hoàn tất đăng ký"}
          </button>
          <button type="button" disabled={resend.isPending} onClick={() => resend.mutate(email, {
            onSuccess: () => toast.success("Đã yêu cầu mã mới", consoleDelivery ? "Kiểm tra log backend." : "Kiểm tra email đăng ký."),
            onError: error => toast.error("Không thể gửi mã", readApiError(error)),
          })}>Gửi lại mã xác thực</button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Đăng ký"
      subtitle="Tạo tài khoản để bắt đầu quản lý rạp, phòng chiếu và đặt vé."
      footer={
        <>
          Đã có tài khoản?{" "}
          <Link
            href="/login"
            className="font-medium text-[#ef4444] underline-offset-2 hover:underline"
          >
            Đăng nhập
          </Link>
        </>
      }
    >
      <form onSubmit={handleRegister} className="mt-8 flex flex-col gap-4">
        {/* Họ và tên */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="fullName"
            className="text-sm font-medium text-[#6b6b66]"
          >
            Họ và tên *
          </label>
          <input
            id="fullName"
            type="text"
            autoComplete="name"
            placeholder="Nguyễn Văn A"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className={fieldClass}
          />
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-[#6b6b66]">
            Email *
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

        {/* Số điện thoại */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="phoneNumber"
            className="text-sm font-medium text-[#6b6b66]"
          >
            Số điện thoại
          </label>
          <input
            id="phoneNumber"
            type="tel"
            autoComplete="tel"
            placeholder="0987654321"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className={fieldClass}
          />
        </div>

        {/* Mật khẩu */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="password"
            className="text-sm font-medium text-[#6b6b66]"
          >
            Mật khẩu *
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Tối thiểu 8 ký tự"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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

        {/* Xác nhận mật khẩu */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="confirmPassword"
            className="text-sm font-medium text-[#6b6b66]"
          >
            Xác nhận mật khẩu *
          </label>
          <input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Nhập lại mật khẩu"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className={fieldClass}
          />
        </div>

        {localError && (
          <p
            role="alert"
            className="rounded-xl border border-[#e7c6b8] bg-[#f8ece6] px-4 py-3 text-sm text-[#a8503a]"
          >
            {localError}
          </p>
        )}

        {registerMutation.isError && (
          <p
            role="alert"
            className="rounded-xl border border-[#e7c6b8] bg-[#f8ece6] px-4 py-3 text-sm text-[#a8503a]"
          >
            {readApiError(registerMutation.error)}
          </p>
        )}

        <button
          type="submit"
          disabled={registerMutation.isPending}
          className="mt-2 rounded-full bg-[#1b1b19] px-6 py-3.5 text-[15px] font-medium text-[#f7f6f1] transition-all hover:-translate-y-0.5 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {registerMutation.isPending ? "Đang xử lý..." : "Tạo tài khoản"}
        </button>
      </form>
    </AuthShell>
  );
}