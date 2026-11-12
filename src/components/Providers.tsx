"use client";

import { useState } from "react";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/components/Toast";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => {
      const client = new QueryClient({
        mutationCache: new MutationCache({ onSuccess: () => { void client.invalidateQueries(); } }),
        defaultOptions: {
          queries: {
            staleTime: 0,
            retry: 1,
          },
        },
      });
      return client;
    }
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
