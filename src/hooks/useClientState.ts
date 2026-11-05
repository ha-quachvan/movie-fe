"use client";
import { useSyncExternalStore } from "react";
import { getAccessToken, isAdmin } from "@/lib/api";
const noopSubscribe = () => () => {};
export function useClientReady() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
function subscribeAuth(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("focus", listener);
  window.addEventListener("auth-change", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("focus", listener);
    window.removeEventListener("auth-change", listener);
  };
}
export function useAccessToken() {
  return useSyncExternalStore(subscribeAuth, getAccessToken, () => null);
}
export function useIsAdmin() {
  return useSyncExternalStore(subscribeAuth, isAdmin, () => false);
}
