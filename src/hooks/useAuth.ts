"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  login,
  register,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
} from "@/lib/api";

export function useLogin() {
  return useMutation({
    mutationFn: (vars: { email: string; password: string }) =>
      login(vars.email, vars.password),
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (vars: {
      email: string;
      fullName: string;
      password: string;
      phoneNumber?: string;
    }) => register(vars.email, vars.fullName, vars.password, vars.phoneNumber),
  });
}

export function useVerifyEmail() {
  const router = useRouter();
  return useMutation({
    mutationFn: (vars: { email: string; otp: string }) =>
      verifyEmail(vars.email, vars.otp),
    onSuccess: () => router.push("/login?registered=1"),
  });
}

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: (vars: { email: string }) => requestPasswordReset(vars.email),
  });
}

export function useResetPassword() {
  const router = useRouter();
  return useMutation({
    mutationFn: (vars: { email: string; otp: string; newPassword: string }) =>
      resetPassword(vars.email, vars.otp, vars.newPassword),
    onSuccess: () => router.push("/login"),
  });
}