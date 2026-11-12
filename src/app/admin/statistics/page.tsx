"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import AdminNav from "@/components/admin/AdminNav";
import {
  getStatisticsSummary,
  getDailyRevenue,
  getTopMoviesRevenue,
  getMonthlyRevenue,
  getSeatOccupancy,
  explainQuery,
  runBenchmark,
  OverviewSummary,
  TopMovieRevenue,
  MonthlyRevenue,
  SeatOccupancy,
  ExplainQueryResponse,
  BenchmarkResponse,
  readApiError,
} from "@/lib/api";

type TabKey = "OVERVIEW" | "OCCUPANCY" | "EXPLAIN" | "BENCHMARK";

const SAMPLE_SQL_QUERIES = [
  {
    title: "1. Thống kê Doanh thu Top Phim (JOIN 4 bảng + GROUP BY + SUM)",
    query: `SELECT 
  m.movie_id AS movieId,
  m.title AS title,
  COUNT(bd.booking_detail_id) AS totalTickets,
  COALESCE(SUM(bd.ticket_price), 0) AS totalRevenue
FROM movies m
JOIN showtimes s ON s.movie_id = m.movie_id
JOIN bookings b ON b.showtime_id = s.showtime_id AND b.booking_status = 'CONFIRMED'
JOIN booking_details bd ON bd.booking_id = b.booking_id AND bd.ticket_status IN ('VALID', 'USED', 'CONFIRMED')
GROUP BY m.movie_id, m.title
ORDER BY totalRevenue DESC
LIMIT 10;`,
  },
  {
    title: "2. Tỷ lệ Lấp đầy Ghế Suất Chiếu (JOIN showtimes, rooms, bookings)",
    query: `SELECT 
  s.showtime_id,
  m.title,
  r.room_name,
  r.total_seats,
  COUNT(bd.booking_detail_id) AS bookedSeats,
  ROUND((COUNT(bd.booking_detail_id) / NULLIF(r.total_seats, 0)) * 100, 2) AS occupancyRate
FROM showtimes s
JOIN movies m ON s.movie_id = m.movie_id
JOIN rooms r ON s.room_id = r.room_id
LEFT JOIN bookings b ON b.showtime_id = s.showtime_id AND b.booking_status = 'CONFIRMED'
LEFT JOIN booking_details bd ON bd.booking_id = b.booking_id
GROUP BY s.showtime_id, m.title, r.room_name, r.total_seats
ORDER BY occupancyRate DESC
LIMIT 20;`,
  },
  {
    title: "3. Tra cứu Vé theo Mã Đặt Chỗ (Index Seek B-Tree trên booking_code)",
    query: `SELECT b.*, s.start_time, m.title
FROM bookings b
JOIN showtimes s ON b.showtime_id = s.showtime_id
JOIN movies m ON s.movie_id = m.movie_id
WHERE b.booking_code = 'BK-DEMO-SAMPLE'
LIMIT 1;`,
  },
  {
    title: "4. Doanh thu theo Tháng (Gom nhóm created_at)",
    query: `SELECT 
  DATE_FORMAT(b.created_at, '%Y-%m') AS month,
  COUNT(b.booking_id) AS bookingCount,
  COALESCE(SUM(b.total_amount), 0) AS revenue
FROM bookings b
WHERE b.booking_status = 'CONFIRMED'
GROUP BY DATE_FORMAT(b.created_at, '%Y-%m')
ORDER BY month DESC;`,
  },
];

export default function AdminStatisticsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("OVERVIEW");

  // Bộ lọc Top Movies
  const [topMoviesLimit, setTopMoviesLimit] = useState<number>(10);

  // Bộ lọc tìm kiếm Occupancy
  const [occupancySearch, setOccupancySearch] = useState("");

  // State cho EXPLAIN Query
  const [sqlInput, setSqlInput] = useState(SAMPLE_SQL_QUERIES[0].query);
  const [explainResult, setExplainResult] = useState<ExplainQueryResponse | null>(null);
  const [explainError, setExplainError] = useState("");

  // State cho Benchmark MySQL vs Redis
  const [iterations, setIterations] = useState<number>(100);
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkResponse | null>(null);
  const [benchmarkError, setBenchmarkError] = useState("");

  const daily = useQuery({ queryKey: ["admin-stats-daily"], queryFn: getDailyRevenue });

  // 1. Fetch Overview KPIs
  const { data: summary, isLoading: isLoadingSummary } = useQuery<OverviewSummary>({
    queryKey: ["admin-stats-summary"],
    queryFn: getStatisticsSummary,
  });

  // 2. Fetch Top Movies Revenue
  const { data: topMovies = [], isLoading: isLoadingTopMovies } = useQuery<TopMovieRevenue[]>({
    queryKey: ["admin-stats-top-movies", topMoviesLimit],
    queryFn: () => getTopMoviesRevenue(topMoviesLimit),
  });

  // 3. Fetch Monthly Revenue
  const { data: monthlyRevenue = [], isLoading: isLoadingMonthly } = useQuery<MonthlyRevenue[]>({
    queryKey: ["admin-stats-monthly-revenue"],
    queryFn: getMonthlyRevenue,
  });

  // 4. Fetch Seat Occupancy Rate
  const { data: seatOccupancy = [], isLoading: isLoadingOccupancy } = useQuery<SeatOccupancy[]>({
    queryKey: ["admin-stats-seat-occupancy"],
    queryFn: getSeatOccupancy,
  });

  // Mutation chạy EXPLAIN Query
  const explainMutation = useMutation({
    mutationFn: (query: string) => explainQuery(query),
    onSuccess: (data) => {
      setExplainResult(data);
      setExplainError("");
    },
    onError: (err) => {
      setExplainError(readApiError(err, "Không thể phân tích câu lệnh SQL này."));
      setExplainResult(null);
    },
  });

  // Mutation chạy Benchmark
  const benchmarkMutation = useMutation({
    mutationFn: (iters: number) => runBenchmark(iters),
    onSuccess: (data) => {
      setBenchmarkResult(data);
      setBenchmarkError("");
    },
    onError: (err) => {
      setBenchmarkError(readApiError(err, "Không thể thực thi đo lường benchmark."));
      setBenchmarkResult(null);
    },
  });

  // Format VND
  const formatCurrency = (val: number | string | undefined) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(num);
  };

  // Max revenue để vẽ biểu đồ thanh tương đối
  const maxMovieRevenue = useMemo(() => {
    if (!topMovies.length) return 1;
    return Math.max(...topMovies.map((m) => m.totalRevenue), 1);
  }, [topMovies]);

  const maxMonthlyRevenue = useMemo(() => {
    if (!monthlyRevenue.length) return 1;
    return Math.max(...monthlyRevenue.map((m) => m.revenue), 1);
  }, [monthlyRevenue]);

  // Lọc seat occupancy theo từ khóa
  const filteredOccupancy = useMemo(() => {
    if (!occupancySearch.trim()) return seatOccupancy;
    const q = occupancySearch.toLowerCase();
    return seatOccupancy.filter(
      (s) =>
        s.movieTitle.toLowerCase().includes(q) ||
        s.roomName.toLowerCase().includes(q) ||
        String(s.showtimeId).includes(q)
    );
  }, [seatOccupancy, occupancySearch]);

  return (
    <div
      style={{
        background: "linear-gradient(180deg, #090a10 0%, #0f101a 100%)",
        minHeight: "100vh",
        color: "#f4f4f5",
        padding: "24px 20px 80px 20px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Navigation Admin Bar */}
        <AdminNav />

        {/* Tiêu đề & Subtitle */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <span
              style={{
                fontSize: "12px",
                fontWeight: "800",
                color: "#c084fc",
                background: "rgba(192, 132, 252, 0.15)",
                padding: "3px 10px",
                borderRadius: "6px",
                letterSpacing: "0.5px",
              }}
            >
              UC-10: BUSINESS INTELLIGENCE & QUERY PROCESSING
            </span>
            <span style={{ color: "#71717a", fontSize: "12px" }}>• BTL DBMS (Mai Anh Tuấn)</span>
          </div>

          <h1
            style={{
              fontSize: "32px",
              fontWeight: "900",
              margin: "0 0 8px 0",
              color: "#ffffff",
              letterSpacing: "-0.02em",
            }}
          >
            📊 Thống Kê Doanh Thu & Hiệu Suất Rạp
          </h1>
          <p style={{ color: "#a1a1aa", fontSize: "15px", margin: 0, maxWidth: "780px" }}>
            Giám sát toàn diện các chỉ số KPIs kinh doanh, phân tích tỷ lệ lấp đầy ghế theo suất chiếu,
            thực thi kế hoạch EXPLAIN Query Plan và đo lường hiệu năng đối đầu trực tiếp giữa MySQL và Redis.
          </p>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            background: "#151622",
            padding: "6px",
            borderRadius: "14px",
            border: "1px solid #27283c",
            marginBottom: "32px",
            flexWrap: "wrap",
          }}
        >
          {[
            { id: "OVERVIEW", label: "📈 Tổng Quan KPIs & Doanh Thu", color: "#8b5cf6" },
            { id: "OCCUPANCY", label: "💺 Hiệu Suất Lấp Đầy Ghế", color: "#10b981" },
            { id: "EXPLAIN", label: "⚡ Phân Tích Kế Hoạch (EXPLAIN Plan)", color: "#f59e0b" },
            { id: "BENCHMARK", label: "🚀 Đối Đầu Hiệu Năng (MySQL vs Redis)", color: "#ec4899" },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabKey)}
                style={{
                  flex: "1 1 200px",
                  padding: "10px 18px",
                  borderRadius: "10px",
                  fontSize: "13px",
                  fontWeight: isActive ? "700" : "500",
                  cursor: "pointer",
                  border: "none",
                  background: isActive ? tab.color : "transparent",
                  color: isActive ? "#ffffff" : "#a1a1aa",
                  transition: "all 0.15s ease",
                  textAlign: "center",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ======================================================== */}
        {/* TAB 1: TỔNG QUAN KPIS & DOANH THU                        */}
        {/* ======================================================== */}
        {activeTab === "OVERVIEW" && (
          <div>
            {/* 5 Thẻ KPIs Số Liệu Trọng Yếu */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                gap: "16px",
                marginBottom: "32px",
              }}
            >
              {/* Card 1: Doanh Thu */}
              <div
                style={{
                  background: "linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(20, 21, 33, 0.8) 100%)",
                  border: "1px solid rgba(139, 92, 246, 0.3)",
                  padding: "20px",
                  borderRadius: "16px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontSize: "12px", color: "#c4b5fd", fontWeight: "600" }}>TỔNG DOANH THU THỰC NHẬN</span>
                  <span style={{ fontSize: "20px" }}>💰</span>
                </div>
                <div style={{ fontSize: "24px", fontWeight: "900", color: "#ffffff", marginBottom: "4px" }}>
                  {isLoadingSummary ? "Đang tính..." : formatCurrency(summary?.totalRevenue)}
                </div>
                <span style={{ fontSize: "11px", color: "#a78bfa" }}>Từ các đơn CONFIRMED & PAID</span>
              </div>

              {/* Card 2: Vé Đã Bán */}
              <div
                style={{
                  background: "linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(20, 21, 33, 0.8) 100%)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  padding: "20px",
                  borderRadius: "16px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontSize: "12px", color: "#6ee7b7", fontWeight: "600" }}>TỔNG VÉ ĐÃ BÁN</span>
                  <span style={{ fontSize: "20px" }}>🎟️</span>
                </div>
                <div style={{ fontSize: "24px", fontWeight: "900", color: "#ffffff", marginBottom: "4px" }}>
                  {isLoadingSummary ? "..." : (summary?.totalTicketsSold || 0).toLocaleString("vi-VN")}
                </div>
                <span style={{ fontSize: "11px", color: "#34d399" }}>Trạng thái VALID / CONFIRMED</span>
              </div>

              {/* Card 3: Đơn Đặt Thành Công */}
              <div
                style={{
                  background: "linear-gradient(135deg, rgba(56, 189, 248, 0.15) 0%, rgba(20, 21, 33, 0.8) 100%)",
                  border: "1px solid rgba(56, 189, 248, 0.3)",
                  padding: "20px",
                  borderRadius: "16px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontSize: "12px", color: "#7dd3fc", fontWeight: "600" }}>ĐƠN THÀNH CÔNG</span>
                  <span style={{ fontSize: "20px" }}>✅</span>
                </div>
                <div style={{ fontSize: "24px", fontWeight: "900", color: "#ffffff", marginBottom: "4px" }}>
                  {isLoadingSummary ? "..." : (summary?.successfulBookings || 0).toLocaleString("vi-VN")}
                </div>
                <span style={{ fontSize: "11px", color: "#38bdf8" }}>Đã xuất hóa đơn & cuống vé</span>
              </div>

              {/* Card 4: Đơn Đã Hủy */}
              <div
                style={{
                  background: "linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(20, 21, 33, 0.8) 100%)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  padding: "20px",
                  borderRadius: "16px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontSize: "12px", color: "#fca5a5", fontWeight: "600" }}>ĐƠN ĐÃ HỦY / HOÀN TIỀN</span>
                  <span style={{ fontSize: "20px" }}>↩️</span>
                </div>
                <div style={{ fontSize: "24px", fontWeight: "900", color: "#ffffff", marginBottom: "4px" }}>
                  {isLoadingSummary ? "..." : (summary?.cancelledBookings || 0).toLocaleString("vi-VN")}
                </div>
                <span style={{ fontSize: "11px", color: "#f87171" }}>Đã kích hoạt Mock/Stripe Refund</span>
              </div>

              {/* Card 5: Tỷ Lệ Hủy Vé */}
              <div
                style={{
                  background: "linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(20, 21, 33, 0.8) 100%)",
                  border: "1px solid rgba(245, 158, 11, 0.3)",
                  padding: "20px",
                  borderRadius: "16px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontSize: "12px", color: "#fde68a", fontWeight: "600" }}>TỶ LỆ HỦY VÉ</span>
                  <span style={{ fontSize: "20px" }}>📉</span>
                </div>
                <div style={{ fontSize: "24px", fontWeight: "900", color: "#ffffff", marginBottom: "4px" }}>
                  {isLoadingSummary ? "..." : summary?.cancellationRate || "0.00%"}
                </div>
                <span style={{ fontSize: "11px", color: "#fbbf24" }}>Chỉ số sức khỏe kinh doanh</span>
              </div>
            </div>

            <section style={{padding: 24, marginBottom: 24, border: "1px solid #333", borderRadius: 12}}>
              <h2>Doanh thu theo ngày (giờ Việt Nam)</h2>
              {daily.isLoading ? <p>Đang tải…</p> : daily.isError ? <p role="alert">{readApiError(daily.error)}</p> : !daily.data?.length ? <p>Chưa có doanh thu theo ngày.</p> :
                <table style={{width: "100%", textAlign: "left"}}><thead><tr><th>Ngày</th><th>Booking thành công</th><th>Doanh thu</th></tr></thead>
                  <tbody>{daily.data.map(row => <tr key={row.date}><td>{row.date}</td><td>{row.bookingCount}</td><td>{Number(row.revenue).toLocaleString("vi-VN")} ₫</td></tr>)}</tbody>
                </table>}
            </section>
            {/* Khối Biểu Đồ Doanh Thu Theo Tháng & Xếp Hạng Top Phim */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(480px, 1fr))",
                gap: "24px",
                marginBottom: "32px",
              }}
            >
              {/* Biểu đồ Doanh Thu Theo Tháng */}
              <div
                style={{
                  background: "#151622",
                  border: "1px solid #27283c",
                  borderRadius: "16px",
                  padding: "24px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                  <div>
                    <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: "800", color: "#fff" }}>
                      📅 Xu Hướng Doanh Thu Theo Tháng
                    </h3>
                    <p style={{ margin: 0, fontSize: "12px", color: "#a1a1aa" }}>
                      Tổng hợp doanh thu và số lượng booking gom nhóm theo tháng
                    </p>
                  </div>
                  <span style={{ fontSize: "12px", color: "#818cf8", background: "#1e1f30", padding: "4px 8px", borderRadius: "6px" }}>
                    GROUP BY DATE_FORMAT
                  </span>
                </div>

                {isLoadingMonthly ? (
                  <p style={{ color: "#a1a1aa", textAlign: "center", padding: "40px 0" }}>Đang tải biểu đồ...</p>
                ) : monthlyRevenue.length === 0 ? (
                  <p style={{ color: "#71717a", textAlign: "center", padding: "40px 0" }}>Chưa có dữ liệu giao dịch theo tháng.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {monthlyRevenue.map((item) => {
                      const percentage = Math.max(5, Math.min(100, (item.revenue / maxMonthlyRevenue) * 100));
                      return (
                        <div key={item.month}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "6px" }}>
                            <strong style={{ color: "#e4e4e7" }}>Tháng {item.month}</strong>
                            <div style={{ display: "flex", gap: "12px" }}>
                              <span style={{ color: "#a1a1aa" }}>{item.bookingCount} đơn</span>
                              <strong style={{ color: "#8b5cf6" }}>{formatCurrency(item.revenue)}</strong>
                            </div>
                          </div>
                          <div
                            style={{
                              width: "100%",
                              height: "10px",
                              background: "#232435",
                              borderRadius: "6px",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${percentage}%`,
                                height: "100%",
                                background: "linear-gradient(90deg, #8b5cf6 0%, #c084fc 100%)",
                                borderRadius: "6px",
                                transition: "width 0.5s ease",
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Bảng Xếp Hạng Top Phim Ăn Khách */}
              <div
                style={{
                  background: "#151622",
                  border: "1px solid #27283c",
                  borderRadius: "16px",
                  padding: "24px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                  <div>
                    <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: "800", color: "#fff" }}>
                      🎬 Top Phim Doanh Thu Cao Nhất
                    </h3>
                    <p style={{ margin: 0, fontSize: "12px", color: "#a1a1aa" }}>
                      Xếp hạng dựa trên tổng số vé bán và doanh thu rạp
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {[5, 10, 20].map((lim) => (
                      <button
                        key={lim}
                        onClick={() => setTopMoviesLimit(lim)}
                        style={{
                          padding: "4px 10px",
                          borderRadius: "6px",
                          border: topMoviesLimit === lim ? "1px solid #e50914" : "1px solid #2e2f45",
                          background: topMoviesLimit === lim ? "#e50914" : "#1c1d2b",
                          color: "#fff",
                          fontSize: "11px",
                          fontWeight: "700",
                          cursor: "pointer",
                        }}
                      >
                        Top {lim}
                      </button>
                    ))}
                  </div>
                </div>

                {isLoadingTopMovies ? (
                  <p style={{ color: "#a1a1aa", textAlign: "center", padding: "40px 0" }}>Đang tải bảng xếp hạng...</p>
                ) : topMovies.length === 0 ? (
                  <p style={{ color: "#71717a", textAlign: "center", padding: "40px 0" }}>Chưa có dữ liệu bán vé cho phim nào.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    {topMovies.map((movie, idx) => {
                      const percentage = Math.max(8, Math.min(100, (movie.totalRevenue / maxMovieRevenue) * 100));
                      const badgeColor = idx === 0 ? "#eab308" : idx === 1 ? "#94a3b8" : idx === 2 ? "#b45309" : "#6b7280";
                      return (
                        <div key={movie.movieId}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px", marginBottom: "6px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span
                                style={{
                                  display: "inline-block",
                                  width: "22px",
                                  height: "22px",
                                  lineHeight: "22px",
                                  textAlign: "center",
                                  borderRadius: "50%",
                                  background: badgeColor,
                                  color: "#fff",
                                  fontWeight: "800",
                                  fontSize: "11px",
                                }}
                              >
                                {idx + 1}
                              </span>
                              <strong style={{ color: "#fff" }}>{movie.title}</strong>
                            </div>
                            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                              <span style={{ fontSize: "12px", color: "#10b981", fontWeight: "600" }}>
                                {movie.totalTickets} vé
                              </span>
                              <strong style={{ color: "#f43f5e" }}>{formatCurrency(movie.totalRevenue)}</strong>
                            </div>
                          </div>
                          <div
                            style={{
                              width: "100%",
                              height: "8px",
                              background: "#232435",
                              borderRadius: "4px",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${percentage}%`,
                                height: "100%",
                                background: "linear-gradient(90deg, #e50914 0%, #f43f5e 100%)",
                                borderRadius: "4px",
                                transition: "width 0.5s ease",
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: HIỆU SUẤT LẤP ĐẦY GHẾ (OCCUPANCY RATE %)          */}
        {/* ======================================================== */}
        {activeTab === "OCCUPANCY" && (
          <div
            style={{
              background: "#151622",
              border: "1px solid #27283c",
              borderRadius: "16px",
              padding: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
                flexWrap: "wrap",
                gap: "14px",
              }}
            >
              <div>
                <h3 style={{ margin: "0 0 4px 0", fontSize: "18px", fontWeight: "800", color: "#fff" }}>
                  💺 Tỷ Lệ Lấp Đầy Ghế Theo Từng Suất Chiếu (Seat Occupancy Rate %)
                </h3>
                <p style={{ margin: 0, fontSize: "13px", color: "#a1a1aa" }}>
                  Công thức: Occupancy Rate (%) = (Số ghế đã bán / Tổng ghế phòng chiếu) × 100%
                </p>
              </div>

              {/* Ô tìm kiếm nhanh */}
              <input
                type="text"
                placeholder="Tìm theo tên phim hoặc phòng chiếu..."
                value={occupancySearch}
                onChange={(e) => setOccupancySearch(e.target.value)}
                style={{
                  padding: "8px 14px",
                  background: "#0f1019",
                  border: "1px solid #2e3047",
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: "13px",
                  minWidth: "260px",
                  outline: "none",
                }}
              />
            </div>

            {/* Bảng Dữ Liệu Occupancy */}
            {isLoadingOccupancy ? (
              <p style={{ textAlign: "center", padding: "40px", color: "#a1a1aa" }}>Đang tính toán tỷ lệ lấp đầy...</p>
            ) : filteredOccupancy.length === 0 ? (
              <p style={{ textAlign: "center", padding: "40px", color: "#71717a" }}>Không tìm thấy suất chiếu nào.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "#1c1d2b", borderBottom: "1px solid #2a2c42", color: "#9ca3af" }}>
                      <th style={{ padding: "12px 14px" }}>MÃ SUẤT</th>
                      <th style={{ padding: "12px 14px" }}>TÊN PHIM</th>
                      <th style={{ padding: "12px 14px" }}>PHÒNG CHIẾU</th>
                      <th style={{ padding: "12px 14px" }}>GIỜ BẮT ĐẦU</th>
                      <th style={{ padding: "12px 14px" }}>GHẾ ĐÃ BÁN</th>
                      <th style={{ padding: "12px 14px", minWidth: "160px" }}>TIẾN ĐỘ LẤP ĐẦY</th>
                      <th style={{ padding: "12px 14px" }}>TỶ LỆ %</th>
                      <th style={{ padding: "12px 14px" }}>ĐÁNH GIÁ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOccupancy.map((item) => {
                      const rateNum = parseFloat(item.occupancyRate) || 0;
                      const isGold = rateNum >= 85;
                      const isGood = rateNum >= 50 && rateNum < 85;

                      return (
                        <tr
                          key={item.showtimeId}
                          style={{
                            borderBottom: "1px solid #202233",
                            transition: "background 0.1s ease",
                          }}
                        >
                          <td style={{ padding: "12px 14px", fontFamily: "monospace", color: "#38bdf8" }}>
                            #{item.showtimeId}
                          </td>
                          <td style={{ padding: "12px 14px", fontWeight: "700", color: "#fff" }}>
                            {item.movieTitle}
                          </td>
                          <td style={{ padding: "12px 14px", color: "#d4d4d8" }}>
                            {item.roomName}
                          </td>
                          <td style={{ padding: "12px 14px", color: "#facc15" }}>
                            {new Date(item.startTime).toLocaleString("vi-VN")}
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            <strong>{item.bookedSeats}</strong> / {item.totalRoomSeats} ghế
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            <div style={{ width: "100%", height: "8px", background: "#26273a", borderRadius: "4px", overflow: "hidden" }}>
                              <div
                                style={{
                                  width: `${Math.min(100, rateNum)}%`,
                                  height: "100%",
                                  background: isGold
                                    ? "linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)"
                                    : isGood
                                    ? "linear-gradient(90deg, #10b981 0%, #34d399 100%)"
                                    : "linear-gradient(90deg, #64748b 0%, #94a3b8 100%)",
                                }}
                              />
                            </div>
                          </td>
                          <td style={{ padding: "12px 14px", fontWeight: "800", color: isGold ? "#fbbf24" : isGood ? "#34d399" : "#94a3b8" }}>
                            {item.occupancyRate}
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            {isGold ? (
                              <span style={{ padding: "3px 8px", borderRadius: "6px", background: "rgba(245, 158, 11, 0.2)", color: "#fbbf24", fontSize: "11px", fontWeight: "700" }}>
                                🌟 Suất Chiếu Vàng
                              </span>
                            ) : isGood ? (
                              <span style={{ padding: "3px 8px", borderRadius: "6px", background: "rgba(16, 185, 129, 0.2)", color: "#34d399", fontSize: "11px", fontWeight: "700" }}>
                                Ổn định
                              </span>
                            ) : (
                              <span style={{ padding: "3px 8px", borderRadius: "6px", background: "rgba(100, 116, 139, 0.2)", color: "#94a3b8", fontSize: "11px" }}>
                                Thấp
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: PHÂN TÍCH KẾ HOẠCH THỰC THI (EXPLAIN PLAN)         */}
        {/* ======================================================== */}
        {activeTab === "EXPLAIN" && (
          <div>
            <div
              style={{
                background: "#151622",
                border: "1px solid #27283c",
                borderRadius: "16px",
                padding: "24px",
                marginBottom: "24px",
              }}
            >
              <div style={{ marginBottom: "16px" }}>
                <h3 style={{ margin: "0 0 6px 0", fontSize: "18px", fontWeight: "800", color: "#fff" }}>
                  ⚡ Phân Tích Kế Hoạch Thực Thi Câu Lệnh (MySQL EXPLAIN Query Plan)
                </h3>
                <p style={{ margin: 0, fontSize: "13px", color: "#a1a1aa" }}>
                  Công cụ chuyên đề Query Processing giúp kiểm tra cách MySQL Optimizer lựa chọn chiến lược truy xuất
                  (Table Scan vs Index Seek/Scan), thứ tự nối bảng (JOIN order) và số dòng ước lượng (Rows Examined).
                </p>
              </div>

              {/* Các câu query mẫu */}
              <div style={{ marginBottom: "16px" }}>
                <span style={{ fontSize: "12px", color: "#a1a1aa", fontWeight: "700", display: "block", marginBottom: "8px" }}>
                  CHỌN TRUY VẤN MẪU ĐỂ KIỂM THỬ:
                </span>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {SAMPLE_SQL_QUERIES.map((sample, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSqlInput(sample.query);
                        setExplainResult(null);
                        setExplainError("");
                      }}
                      style={{
                        padding: "6px 12px",
                        background: sqlInput === sample.query ? "#f59e0b" : "#1f2030",
                        color: sqlInput === sample.query ? "#000" : "#d4d4d8",
                        border: "1px solid #33354f",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: "600",
                        cursor: "pointer",
                      }}
                    >
                      {sample.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Textarea nhập SQL */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", color: "#a1a1aa", marginBottom: "6px" }}>
                  CÂU LỆNH SQL (CHỈ CHẤP NHẬN CÂU TRUY VẤN SELECT AN TOÀN):
                </label>
                <textarea
                  rows={8}
                  value={sqlInput}
                  onChange={(e) => setSqlInput(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "14px",
                    background: "#0c0d15",
                    border: "1px solid #2e3047",
                    borderRadius: "10px",
                    color: "#38bdf8",
                    fontFamily: "Consolas, Menlo, Monaco, monospace",
                    fontSize: "13px",
                    lineHeight: "1.5",
                    outline: "none",
                  }}
                />
              </div>

              {/* Button Thực thi EXPLAIN */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  onClick={() => explainMutation.mutate(sqlInput)}
                  disabled={explainMutation.isPending || !sqlInput.trim()}
                  style={{
                    padding: "10px 24px",
                    background: explainMutation.isPending ? "#4b5563" : "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "10px",
                    fontWeight: "700",
                    fontSize: "14px",
                    cursor: explainMutation.isPending ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 14px rgba(245, 158, 11, 0.3)",
                  }}
                >
                  {explainMutation.isPending ? "Đang phân tích EXPLAIN..." : "🚀 Chạy Phân Tích Kế Hoạch (EXPLAIN)"}
                </button>
              </div>

              {/* Thông báo lỗi nếu có */}
              {explainError && (
                <div
                  style={{
                    marginTop: "16px",
                    padding: "12px 16px",
                    background: "rgba(239, 68, 68, 0.15)",
                    border: "1px solid #ef4444",
                    borderRadius: "8px",
                    color: "#f87171",
                    fontSize: "13px",
                  }}
                >
                  ⚠️ Lỗi thực thi: {explainError}
                </div>
              )}
            </div>

            {/* Bảng Kế Hoạch Thực Thi (Execution Plan Table) */}
            {explainResult && (
              <div
                style={{
                  background: "#151622",
                  border: "1px solid #27283c",
                  borderRadius: "16px",
                  padding: "24px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "16px",
                    flexWrap: "wrap",
                    gap: "10px",
                  }}
                >
                  <div>
                    <h4 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: "800", color: "#10b981" }}>
                      ✅ Kế Hoạch Thực Thi Của MySQL Optimizer (Execution Plan)
                    </h4>
                    <span style={{ fontSize: "12px", color: "#a1a1aa" }}>
                      Thời gian phản hồi truy vấn:{" "}
                      <strong style={{ color: "#facc15" }}>{explainResult.executionTimeMs}</strong>
                    </span>
                  </div>
                </div>

                <div style={{ overflowX: "auto", marginBottom: "20px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
                    <thead>
                      <tr style={{ background: "#1c1d2b", borderBottom: "1px solid #2a2c42", color: "#9ca3af" }}>
                        <th style={{ padding: "10px" }}>id</th>
                        <th style={{ padding: "10px" }}>select_type</th>
                        <th style={{ padding: "10px" }}>table</th>
                        <th style={{ padding: "10px" }}>type</th>
                        <th style={{ padding: "10px" }}>possible_keys</th>
                        <th style={{ padding: "10px" }}>key</th>
                        <th style={{ padding: "10px" }}>key_len</th>
                        <th style={{ padding: "10px" }}>ref</th>
                        <th style={{ padding: "10px" }}>rows</th>
                        <th style={{ padding: "10px" }}>filtered</th>
                        <th style={{ padding: "10px" }}>Extra</th>
                      </tr>
                    </thead>
                    <tbody>
                      {explainResult.executionPlan.map((row, idx) => (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: "1px solid #202233",
                            background: idx % 2 === 0 ? "#13141f" : "#161724",
                          }}
                        >
                          <td style={{ padding: "10px", fontFamily: "monospace" }}>{row.id}</td>
                          <td style={{ padding: "10px", color: "#c084fc" }}>{row.select_type}</td>
                          <td style={{ padding: "10px", fontWeight: "700", color: "#38bdf8" }}>{row.table}</td>
                          <td style={{ padding: "10px", fontWeight: "800", color: row.type === "ALL" ? "#ef4444" : "#10b981" }}>
                            {row.type}
                          </td>
                          <td style={{ padding: "10px", color: "#9ca3af" }}>{row.possible_keys || "NULL"}</td>
                          <td style={{ padding: "10px", color: "#facc15", fontWeight: "700" }}>{row.key || "NULL"}</td>
                          <td style={{ padding: "10px" }}>{row.key_len || "NULL"}</td>
                          <td style={{ padding: "10px", color: "#a1a1aa" }}>{row.ref || "NULL"}</td>
                          <td style={{ padding: "10px", fontWeight: "700", color: "#fff" }}>{row.rows}</td>
                          <td style={{ padding: "10px" }}>{row.filtered}%</td>
                          <td style={{ padding: "10px", color: "#fbbf24", fontSize: "11px" }}>{row.Extra || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Nhận xét học thuật về Query Processing */}
                <div
                  style={{
                    background: "rgba(56, 189, 248, 0.08)",
                    border: "1px solid rgba(56, 189, 248, 0.25)",
                    borderRadius: "12px",
                    padding: "16px",
                    fontSize: "13px",
                    lineHeight: "1.6",
                    color: "#bae6fd",
                  }}
                >
                  <strong style={{ color: "#38bdf8", display: "block", marginBottom: "4px" }}>
                    💡 Phân Tích Chuyên Sâu DBMS (Query Optimization Analysis):
                  </strong>
                  • <strong>Kiểu truy cập (Access Type):</strong> Nếu cột <code>type</code> hiển thị{" "}
                  <code style={{ color: "#10b981" }}>eq_ref</code> hoặc <code style={{ color: "#10b981" }}>ref</code>,
                  bộ tối ưu hóa đang tận dụng triệt để B-Tree Index (Khóa chính hoặc Khóa ngoại) để truy xuất dữ liệu O(log N).
                  Trường hợp xuất hiện <code style={{ color: "#ef4444" }}>ALL</code> nghĩa là hệ thống phải quét toàn bộ bảng (Full Table Scan).
                  <br />
                  • <strong>Dòng duyệt ước tính (Rows Examined):</strong> Tích các giá trị cột <code>rows</code> phản ánh không gian tìm kiếm
                  trong tích Descartes ban đầu trước khi phép lọc (Predicate Evaluation) được áp dụng.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: THỰC NGHIỆM ĐỐI ĐẦU HIỆU NĂNG (MYSQL VS REDIS)    */}
        {/* ======================================================== */}
        {activeTab === "BENCHMARK" && (
          <div>
            <div
              style={{
                background: "#151622",
                border: "1px solid #27283c",
                borderRadius: "16px",
                padding: "24px",
                marginBottom: "24px",
              }}
            >
              <div style={{ marginBottom: "20px" }}>
                <h3 style={{ margin: "0 0 6px 0", fontSize: "18px", fontWeight: "800", color: "#fff" }}>
                  🚀 Thử Nghiệm Đo Lường Hiệu Năng Trực Tiếp: MySQL 8.0 vs Redis 7.x
                </h3>
                <p style={{ margin: 0, fontSize: "13px", color: "#a1a1aa" }}>
                  Thực nghiệm đối đầu giữa cơ sở dữ liệu quan hệ đĩa từ (MySQL InnoDB) và bộ nhớ đệm In-Memory (Redis Key-Value)
                  trên 2 kịch bản: <strong>Đọc đơn lẻ (Point Read)</strong> và <strong>Truy vấn phân tích nối 4 bảng (Complex Analytics)</strong>.
                </p>
              </div>

              {/* Lựa chọn số lần lặp */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "14px",
                  background: "#1c1d2c",
                  padding: "16px",
                  borderRadius: "12px",
                }}
              >
                <div>
                  <span style={{ fontSize: "13px", fontWeight: "700", color: "#fff", display: "block", marginBottom: "4px" }}>
                    Số lần lặp thử nghiệm (Iterations N):
                  </span>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {[50, 100, 200, 500].map((n) => (
                      <button
                        key={n}
                        onClick={() => setIterations(n)}
                        style={{
                          padding: "6px 14px",
                          borderRadius: "6px",
                          border: iterations === n ? "1px solid #ec4899" : "1px solid #33354d",
                          background: iterations === n ? "#ec4899" : "#12131d",
                          color: "#fff",
                          fontSize: "12px",
                          fontWeight: "700",
                          cursor: "pointer",
                        }}
                      >
                        N = {n}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => benchmarkMutation.mutate(iterations)}
                  disabled={benchmarkMutation.isPending}
                  style={{
                    padding: "12px 28px",
                    background: benchmarkMutation.isPending ? "#4b5563" : "linear-gradient(135deg, #ec4899 0%, #be185d 100%)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "10px",
                    fontWeight: "800",
                    fontSize: "14px",
                    cursor: benchmarkMutation.isPending ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 14px rgba(236, 72, 153, 0.4)",
                  }}
                >
                  {benchmarkMutation.isPending ? "Đang chạy benchmark..." : `⚡ Bắt Đầu Đo Lường (${iterations} lần)`}
                </button>
              </div>

              {benchmarkError && (
                <div
                  style={{
                    marginTop: "16px",
                    padding: "12px 16px",
                    background: "rgba(239, 68, 68, 0.15)",
                    border: "1px solid #ef4444",
                    borderRadius: "8px",
                    color: "#f87171",
                    fontSize: "13px",
                  }}
                >
                  ⚠️ Lỗi đo lường: {benchmarkError}
                </div>
              )}
            </div>

            {/* Kết Quả Đo Lường Benchmark */}
            {benchmarkResult && (
              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                {/* Case 1: Point Lookup Test */}
                <div
                  style={{
                    background: "#151622",
                    border: "1px solid #27283c",
                    borderRadius: "16px",
                    padding: "24px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <div>
                      <span style={{ fontSize: "11px", fontWeight: "800", color: "#ec4899", letterSpacing: "1px" }}>
                        KỊCH BẢN 1 (TEST A)
                      </span>
                      <h4 style={{ margin: "4px 0", fontSize: "18px", fontWeight: "800", color: "#fff" }}>
                        Point Read (Đọc Đơn Lẻ Theo Khóa Chính)
                      </h4>
                      <p style={{ margin: 0, fontSize: "12px", color: "#a1a1aa" }}>
                        {benchmarkResult.pointLookupTest.operation}
                      </p>
                    </div>

                    <div
                      style={{
                        padding: "6px 14px",
                        background: "rgba(16, 185, 129, 0.15)",
                        border: "1px solid #10b981",
                        borderRadius: "20px",
                        color: "#34d399",
                        fontWeight: "800",
                        fontSize: "13px",
                      }}
                    >
                      🏆 Chiến thắng: {benchmarkResult.pointLookupTest.winner} (Nhanh hơn ~{benchmarkResult.pointLookupTest.speedupFactor}x)
                    </div>
                  </div>

                  {/* Bảng so sánh chỉ số */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "16px",
                      marginBottom: "16px",
                    }}
                  >
                    {/* Redis Card */}
                    <div style={{ background: "#1b1c2b", border: "1px solid #2e3047", padding: "16px", borderRadius: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                        <strong style={{ color: "#ec4899", fontSize: "15px" }}>🔴 REDIS (In-Memory Key-Value)</strong>
                        <span style={{ fontSize: "11px", color: "#a1a1aa" }}>O(1) Hash Lookup</span>
                      </div>
                      <div style={{ fontSize: "13px", lineHeight: "1.8", color: "#d4d4d8" }}>
                        <div>• Tổng thời gian ({benchmarkResult.iterations} op): <strong>{benchmarkResult.pointLookupTest.redis.totalTimeMs}</strong></div>
                        <div>• Thời gian trung bình: <strong style={{ color: "#34d399" }}>{benchmarkResult.pointLookupTest.redis.avgTimePerOpMs}</strong></div>
                        <div>• Thông lượng (Throughput): <strong style={{ color: "#38bdf8" }}>{benchmarkResult.pointLookupTest.redis.throughputOpsSec.toLocaleString()} ops/giây</strong></div>
                      </div>
                    </div>

                    {/* MySQL Card */}
                    <div style={{ background: "#1b1c2b", border: "1px solid #2e3047", padding: "16px", borderRadius: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                        <strong style={{ color: "#38bdf8", fontSize: "15px" }}>🐬 MYSQL 8.0 (InnoDB B-Tree)</strong>
                        <span style={{ fontSize: "11px", color: "#a1a1aa" }}>O(log N) Clustered Index</span>
                      </div>
                      <div style={{ fontSize: "13px", lineHeight: "1.8", color: "#d4d4d8" }}>
                        <div>• Tổng thời gian ({benchmarkResult.iterations} op): <strong>{benchmarkResult.pointLookupTest.mysql.totalTimeMs}</strong></div>
                        <div>• Thời gian trung bình: <strong style={{ color: "#facc15" }}>{benchmarkResult.pointLookupTest.mysql.avgTimePerOpMs}</strong></div>
                        <div>• Thông lượng (Throughput): <strong style={{ color: "#38bdf8" }}>{benchmarkResult.pointLookupTest.mysql.throughputOpsSec.toLocaleString()} ops/giây</strong></div>
                      </div>
                    </div>
                  </div>

                  <p style={{ margin: 0, fontSize: "13px", color: "#a5b4fc", fontStyle: "italic" }}>
                    💬 Nhận xét: {benchmarkResult.pointLookupTest.analysis}
                  </p>
                </div>

                {/* Case 2: Complex Analytics Test */}
                <div
                  style={{
                    background: "#151622",
                    border: "1px solid #27283c",
                    borderRadius: "16px",
                    padding: "24px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <div>
                      <span style={{ fontSize: "11px", fontWeight: "800", color: "#38bdf8", letterSpacing: "1px" }}>
                        KỊCH BẢN 2 (TEST B)
                      </span>
                      <h4 style={{ margin: "4px 0", fontSize: "18px", fontWeight: "800", color: "#fff" }}>
                        Complex Analytics (Truy Vấn Nối 4 Bảng + Gom Nhóm Aggregate)
                      </h4>
                      <p style={{ margin: 0, fontSize: "12px", color: "#a1a1aa" }}>
                        {benchmarkResult.complexAnalyticsTest.operation}
                      </p>
                    </div>

                    <div
                      style={{
                        padding: "6px 14px",
                        background: "rgba(56, 189, 248, 0.15)",
                        border: "1px solid #38bdf8",
                        borderRadius: "20px",
                        color: "#38bdf8",
                        fontWeight: "800",
                        fontSize: "13px",
                      }}
                    >
                      🏆 Chiến thắng: {benchmarkResult.complexAnalyticsTest.winner}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "16px",
                      marginBottom: "16px",
                    }}
                  >
                    {/* MySQL Relational */}
                    <div style={{ background: "#1b1c2b", border: "1px solid #2e3047", padding: "16px", borderRadius: "12px" }}>
                      <strong style={{ color: "#38bdf8", fontSize: "15px", display: "block", marginBottom: "8px" }}>
                        🐬 MYSQL (Relational Engine)
                      </strong>
                      <div style={{ fontSize: "13px", lineHeight: "1.8", color: "#d4d4d8" }}>
                        <div>• Hỗ trợ: <strong style={{ color: "#10b981" }}>Có (Native SQL Engine)</strong></div>
                        <div>• Thời gian thực thi: <strong style={{ color: "#38bdf8" }}>{benchmarkResult.complexAnalyticsTest.mysql.executionTimeMs}</strong></div>
                        <div>• Cơ chế: <strong>{benchmarkResult.complexAnalyticsTest.mysql.method}</strong></div>
                        <div>• Mức độ phù hợp: <strong style={{ color: "#10b981" }}>{benchmarkResult.complexAnalyticsTest.mysql.suitability}</strong></div>
                      </div>
                    </div>

                    {/* Redis Key-Value */}
                    <div style={{ background: "#1b1c2b", border: "1px solid #2e3047", padding: "16px", borderRadius: "12px" }}>
                      <strong style={{ color: "#ec4899", fontSize: "15px", display: "block", marginBottom: "8px" }}>
                        🔴 REDIS (Pure Key-Value)
                      </strong>
                      <div style={{ fontSize: "13px", lineHeight: "1.8", color: "#d4d4d8" }}>
                        <div>• Hỗ trợ Native JOIN: <strong style={{ color: "#ef4444" }}>Không hỗ trợ</strong></div>
                        <div>• Cơ chế: <strong>{benchmarkResult.complexAnalyticsTest.redis.method}</strong></div>
                        <div>• Mức độ phù hợp: <strong style={{ color: "#ef4444" }}>{benchmarkResult.complexAnalyticsTest.redis.suitability}</strong></div>
                      </div>
                    </div>
                  </div>

                  <p style={{ margin: 0, fontSize: "13px", color: "#a5b4fc", fontStyle: "italic" }}>
                    💬 Nhận xét: {benchmarkResult.complexAnalyticsTest.analysis}
                  </p>
                </div>

                {/* Kết Luận Kiến Trúc Tổng Thể */}
                <div
                  style={{
                    background: "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(20, 21, 33, 0.8) 100%)",
                    border: "1px solid rgba(139, 92, 246, 0.35)",
                    borderRadius: "16px",
                    padding: "20px",
                  }}
                >
                  <h4 style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: "800", color: "#c084fc" }}>
                    🎯 Kết Luận Kiến Trúc DBMS (System Architecture Conclusion):
                  </h4>
                  <p style={{ margin: 0, fontSize: "13px", lineHeight: "1.7", color: "#e4e4e7" }}>
                    {benchmarkResult.architectureConclusion}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
