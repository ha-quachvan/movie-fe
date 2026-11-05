"use client";
import { useQuery } from "@tanstack/react-query";
import { getProfile } from "@/lib/api";
import { useAccessToken } from "./useClientState";
export function useProfile() {
  const token = useAccessToken();
  return useQuery({ queryKey: ["profile", token], queryFn: getProfile, enabled: Boolean(token), retry: false, staleTime: 5 * 60 * 1000 });
}
