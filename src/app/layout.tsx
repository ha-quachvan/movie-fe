import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "CineBook - Quản lý rạp phim",
  description: "Quản lý rạp phim, phòng chiếu, suất chiếu và doanh thu của bạn. Đặt vé trực tuyến dễ dàng cho khách hàng.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className="h-full antialiased"
    >
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
