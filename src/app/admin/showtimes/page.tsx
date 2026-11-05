"use client";

import { useState, useMemo, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminNav from "@/components/admin/AdminNav";
import {
  getShowtimes,
  getMovies,
  getCinemas,
  createShowtime,
  updateShowtime,
  cancelShowtime,
  checkShowtimeConflict,
  Showtime,
  Room,
  CreateShowtimePayload,
  UpdateShowtimePayload,
  ShowtimeStatus,
  CheckConflictResponse,
  readApiError,
} from "@/lib/api";

function ShowtimesManagerContent() {
  const queryClient = useQueryClient();

  // State Bộ lọc danh sách
  const [filterMovieId, setFilterMovieId] = useState<number | "ALL">("ALL");
  const [filterCinemaId, setFilterCinemaId] = useState<number | "ALL">("ALL");
  const [filterRoomId, setFilterRoomId] = useState<number | "ALL">("ALL");
  const [filterDate, setFilterDate] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  // State Modal Tạo / Sửa
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShowtime, setEditingShowtime] = useState<Showtime | null>(null);
  const [formError, setFormError] = useState("");

  // Form Fields
  const [formMovieId, setFormMovieId] = useState<number>(1);
  const [formCinemaId, setFormCinemaId] = useState<number>(1);
  const [formRoomId, setFormRoomId] = useState<number>(1);
  const [formStartTime, setFormStartTime] = useState<string>("");
  const [formEndTime, setFormEndTime] = useState<string>("");
  const [formBasePrice, setFormBasePrice] = useState<number>(85000);
  const [formCleanupMinutes, setFormCleanupMinutes] = useState<number>(15);

  // State Modal Kiểm tra Xung đột Độc lập (Independent Conflict Checker)
  const [isConflictCheckerOpen, setIsConflictCheckerOpen] = useState(false);
  const [checkCinemaId, setCheckCinemaId] = useState<number>(1);
  const [checkRoomId, setCheckRoomId] = useState<number>(1);
  const [checkStartTime, setCheckStartTime] = useState<string>("");
  const [checkEndTime, setCheckEndTime] = useState<string>("");
  const [checkCleanup, setCheckCleanup] = useState<number>(15);
  const [conflictResult, setConflictResult] = useState<CheckConflictResponse | null>(null);
  const [conflictChecking, setConflictChecking] = useState(false);
  const [conflictError, setConflictError] = useState("");

  // Toast message
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // 1. Fetch Danh sách Phim
  const { data: movies = [] } = useQuery({
    queryKey: ["admin-movies-list"],
    queryFn: getMovies,
  });

  // 2. Fetch Danh sách Rạp & Phòng
  const { data: cinemas = [] } = useQuery({
    queryKey: ["admin-cinemas-list"],
    queryFn: getCinemas,
  });

  // 3. Fetch Danh sách Suất chiếu theo bộ lọc
  const {
    data: showtimes = [],
    isLoading: isLoadingShowtimes,
    refetch: refetchShowtimes,
  } = useQuery({
    queryKey: [
      "admin-showtimes",
      filterMovieId,
      filterCinemaId,
      filterRoomId,
      filterDate,
      filterStatus,
    ],
    queryFn: () =>
      getShowtimes({
        movieId: filterMovieId !== "ALL" ? Number(filterMovieId) : undefined,
        cinemaId: filterCinemaId !== "ALL" ? Number(filterCinemaId) : undefined,
        roomId: filterRoomId !== "ALL" ? Number(filterRoomId) : undefined,
        date: filterDate || undefined,
        status: filterStatus !== "ALL" ? (filterStatus as ShowtimeStatus) : undefined,
      }),
  });

  // Phòng của rạp đang chọn trong bộ lọc
  const filterRooms: Room[] = useMemo(() => {
    if (filterCinemaId === "ALL") return [];
    const cinema = cinemas.find((c) => c.id === Number(filterCinemaId));
    return cinema?.rooms || [];
  }, [cinemas, filterCinemaId]);

  // Phòng của rạp đang chọn trong Form
  const formRooms: Room[] = useMemo(() => {
    const cinema = cinemas.find((c) => c.id === formCinemaId);
    return cinema?.rooms || [];
  }, [cinemas, formCinemaId]);

  // Phòng của rạp đang chọn trong Conflict Checker
  const checkRooms: Room[] = useMemo(() => {
    const cinema = cinemas.find((c) => c.id === checkCinemaId);
    return cinema?.rooms || [];
  }, [cinemas, checkCinemaId]);

  // Khi chọn phim trong form, tự động gợi ý giờ kết thúc theo durationMinutes
  const handleFormMovieChange = (movieId: number) => {
    setFormMovieId(movieId);
    const movie = movies.find((m) => m.id === movieId);
    if (movie && formStartTime) {
      try {
        const start = new Date(formStartTime);
        if (!isNaN(start.getTime())) {
          const end = new Date(start.getTime() + (movie.durationMinutes || 120) * 60000);
          // Format về YYYY-MM-DDTHH:mm
          const localIso = new Date(end.getTime() - end.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
          setFormEndTime(localIso);
        }
      } catch {}
    }
  };

  // Tự động tính end time khi start time thay đổi
  const handleFormStartTimeChange = (startStr: string) => {
    setFormStartTime(startStr);
    const movie = movies.find((m) => m.id === formMovieId);
    if (movie && startStr) {
      try {
        const start = new Date(startStr);
        if (!isNaN(start.getTime())) {
          const end = new Date(start.getTime() + (movie.durationMinutes || 120) * 60000);
          const localIso = new Date(end.getTime() - end.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
          setFormEndTime(localIso);
        }
      } catch {}
    }
  };

  // 4. Mutations
  const createMutation = useMutation({
    mutationFn: createShowtime,
    onSuccess: () => {
      setIsModalOpen(false);
      setToastMessage({ text: "Tạo suất chiếu mới thành công!", type: "success" });
      queryClient.invalidateQueries({ queryKey: ["admin-showtimes"] });
      void refetchShowtimes();
    },
    onError: (err) => {
      setFormError(readApiError(err, "Không thể tạo suất chiếu."));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateShowtimePayload }) => updateShowtime(id, payload),
    onSuccess: () => {
      setIsModalOpen(false);
      setToastMessage({ text: "Cập nhật suất chiếu thành công!", type: "success" });
      queryClient.invalidateQueries({ queryKey: ["admin-showtimes"] });
      void refetchShowtimes();
    },
    onError: (err) => {
      setFormError(readApiError(err, "Không thể cập nhật suất chiếu."));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelShowtime,
    onSuccess: () => {
      setToastMessage({ text: "Đã hủy suất chiếu thành công!", type: "success" });
      queryClient.invalidateQueries({ queryKey: ["admin-showtimes"] });
      void refetchShowtimes();
    },
    onError: (err) => {
      alert(`Lỗi khi hủy suất chiếu: ${readApiError(err)}`);
    },
  });

  // Mở modal tạo mới
  const openCreateModal = () => {
    setEditingShowtime(null);
    setFormError("");

    const firstMovieId = movies[0]?.id || 1;
    const firstCinemaId = cinemas[0]?.id || 1;
    const firstRoomId = cinemas[0]?.rooms?.[0]?.id || 1;

    setFormMovieId(firstMovieId);
    setFormCinemaId(firstCinemaId);
    setFormRoomId(firstRoomId);
    setFormBasePrice(85000);
    setFormCleanupMinutes(15);

    // Mặc định thời gian: ngày mai lúc 19:00
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(19, 0, 0, 0);
    const startIso = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);

    const duration = movies[0]?.durationMinutes || 120;
    const end = new Date(tomorrow.getTime() + duration * 60000);
    const endIso = new Date(end.getTime() - end.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);

    setFormStartTime(startIso);
    setFormEndTime(endIso);
    setIsModalOpen(true);
  };

  // Mở modal sửa
  const openEditModal = (showtime: Showtime) => {
    setEditingShowtime(showtime);
    setFormError("");

    setFormMovieId(showtime.movieId);
    setFormRoomId(showtime.roomId);
    setFormBasePrice(Number(showtime.basePrice));
    setFormCleanupMinutes(showtime.cleanupMinutes || 15);

    // Tìm cinemaId từ roomId
    for (const c of cinemas) {
      if (c.rooms?.some((r) => r.id === showtime.roomId)) {
        setFormCinemaId(c.id);
        break;
      }
    }

    try {
      const s = new Date(showtime.startTime);
      const e = new Date(showtime.endTime);
      setFormStartTime(
        new Date(s.getTime() - s.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
      );
      setFormEndTime(
        new Date(e.getTime() - e.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
      );
    } catch {}

    setIsModalOpen(true);
  };

  // Submit Handler: Tạo / Sửa
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const start = new Date(formStartTime);
    const end = new Date(formEndTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      setFormError("Vui lòng chọn đầy đủ thời gian bắt đầu và kết thúc.");
      return;
    }
    if (end <= start) {
      setFormError("Thời gian kết thúc phải sau thời gian bắt đầu.");
      return;
    }

    const movie = movies.find((m) => m.id === formMovieId);
    if (movie && (end.getTime() - start.getTime()) / 60000 < movie.durationMinutes) {
      setFormError(`Thời gian chiếu phải tối thiểu bằng thời lượng phim (${movie.durationMinutes} phút).`);
      return;
    }

    // Tự động kiểm tra xung đột trước khi tạo
    try {
      const conflictCheck = await checkShowtimeConflict({
        roomId: formRoomId,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        cleanupMinutes: Number(formCleanupMinutes),
        excludeShowtimeId: editingShowtime ? editingShowtime.id : undefined,
      });

      if (conflictCheck.hasConflict) {
        const firstConflict = conflictCheck.conflicts?.[0];
        setFormError(
          `Khung giờ này bị TRÙNG LỊCH CHIẾU với phim "${firstConflict?.movieTitle || "Khác"}" (${
            firstConflict?.startTime ? new Date(firstConflict.startTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : ""
          } - ${
            firstConflict?.endTime ? new Date(firstConflict.endTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : ""
          }). Vui lòng chọn khung giờ khác!`
        );
        return;
      }
    } catch {
      // Nếu không kiểm tra được, tiếp tục gửi để backend chặn
    }

    const payload: CreateShowtimePayload = {
      movieId: formMovieId,
      roomId: formRoomId,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      basePrice: Number(formBasePrice),
      cleanupMinutes: Number(formCleanupMinutes),
    };

    if (editingShowtime) {
      updateMutation.mutate({ id: editingShowtime.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // Handler: Kiểm tra Xung Đột Độc Lập
  const handleRunConflictCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setConflictError("");
    setConflictResult(null);

    const start = new Date(checkStartTime);
    const end = new Date(checkEndTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      setConflictError("Vui lòng chọn ngày giờ bắt đầu và kết thúc.");
      return;
    }
    if (end <= start) {
      setConflictError("Thời gian kết thúc phải sau thời gian bắt đầu.");
      return;
    }

    setConflictChecking(true);
    try {
      const res = await checkShowtimeConflict({
        roomId: checkRoomId,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        cleanupMinutes: Number(checkCleanup),
      });
      setConflictResult(res);
    } catch (err) {
      setConflictError(readApiError(err, "Không thể kiểm tra xung đột lịch."));
    } finally {
      setConflictChecking(false);
    }
  };

  // Format Helper
  const formatDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0e0708", color: "#f4f4f5", padding: "24px 32px", fontFamily: "var(--font-be-vietnam), system-ui, sans-serif" }}>
      {/* 1. Thanh điều hướng Admin Tabs */}
      <AdminNav />

      {/* 2. Tiêu đề Trang & Action Buttons */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "28px" }}>📅</span>
            <h1 style={{ fontSize: "26px", fontWeight: "800", color: "#fff", margin: 0 }}>
              Quản Lý Suất Chiếu & Kiểm Tra Xung Đột (UC4)
            </h1>
          </div>
          <p style={{ color: "#a1a1aa", fontSize: "14px", margin: "6px 0 0 0" }}>
            Lên lịch chiếu, phát hiện xung đột phòng chiếu kèm thời gian dọn phòng, tự động sinh sơ đồ ghế
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              setConflictResult(null);
              setConflictError("");
              setCheckCinemaId(cinemas[0]?.id || 1);
              setCheckRoomId(cinemas[0]?.rooms?.[0]?.id || 1);

              const now = new Date();
              now.setHours(now.getHours() + 2, 0, 0, 0);
              const startIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
              const end = new Date(now.getTime() + 120 * 60000);
              const endIso = new Date(end.getTime() - end.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
              setCheckStartTime(startIso);
              setCheckEndTime(endIso);
              setIsConflictCheckerOpen(true);
            }}
            style={{
              padding: "10px 18px",
              background: "#1f2937",
              color: "#38bdf8",
              border: "1px solid #0284c7",
              borderRadius: "8px",
              fontWeight: "700",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            ⚡ Kiểm Tra Xung Đột Độc Lập
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            style={{
              padding: "10px 20px",
              background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontWeight: "700",
              fontSize: "14px",
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(245, 158, 11, 0.35)",
            }}
          >
            + Tạo Suất Chiếu Mới
          </button>
        </div>
      </div>

      {/* Thông báo toast */}
      {toastMessage && (
        <div
          style={{
            padding: "12px 18px",
            borderRadius: "8px",
            marginBottom: "20px",
            background: toastMessage.type === "success" ? "#064e3b" : "#7f1d1d",
            color: "#fff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            border: `1px solid ${toastMessage.type === "success" ? "#059669" : "#dc2626"}`,
          }}
        >
          <span>{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", fontWeight: "bold" }}>
            ✕
          </button>
        </div>
      )}

      {/* 3. Bộ lọc Đa Tiêu Chí */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "14px",
          marginBottom: "24px",
          background: "#18181b",
          padding: "18px 20px",
          borderRadius: "12px",
          border: "1px solid #27272a",
          alignItems: "flex-end",
        }}
      >
        <div>
          <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#a1a1aa", textTransform: "uppercase", marginBottom: "6px" }}>
            Phim:
          </label>
          <select
            value={filterMovieId}
            onChange={(e) => setFilterMovieId(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
            style={{ width: "100%", padding: "9px 12px", background: "#09090b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#fff", fontSize: "13px" }}
          >
            <option value="ALL">Tất cả phim</option>
            {movies.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#a1a1aa", textTransform: "uppercase", marginBottom: "6px" }}>
            Rạp chiếu:
          </label>
          <select
            value={filterCinemaId}
            onChange={(e) => {
              const val = e.target.value === "ALL" ? "ALL" : Number(e.target.value);
              setFilterCinemaId(val);
              setFilterRoomId("ALL");
            }}
            style={{ width: "100%", padding: "9px 12px", background: "#09090b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#fff", fontSize: "13px" }}
          >
            <option value="ALL">Tất cả cụm rạp</option>
            {cinemas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#a1a1aa", textTransform: "uppercase", marginBottom: "6px" }}>
            Phòng chiếu:
          </label>
          <select
            value={filterRoomId}
            onChange={(e) => setFilterRoomId(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
            disabled={filterCinemaId === "ALL"}
            style={{ width: "100%", padding: "9px 12px", background: "#09090b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#fff", fontSize: "13px", opacity: filterCinemaId === "ALL" ? 0.5 : 1 }}
          >
            <option value="ALL">Tất cả phòng</option>
            {filterRooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#a1a1aa", textTransform: "uppercase", marginBottom: "6px" }}>
            Ngày chiếu:
          </label>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            style={{ width: "100%", padding: "8px 12px", background: "#09090b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#fff", fontSize: "13px" }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#a1a1aa", textTransform: "uppercase", marginBottom: "6px" }}>
            Trạng thái:
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ width: "100%", padding: "9px 12px", background: "#09090b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#fff", fontSize: "13px" }}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="SCHEDULED">Đang mở bán (SCHEDULED)</option>
            <option value="CANCELLED">Đã hủy (CANCELLED)</option>
            <option value="COMPLETED">Đã chiếu (COMPLETED)</option>
          </select>
        </div>

        <div>
          <button
            type="button"
            onClick={() => {
              setFilterMovieId("ALL");
              setFilterCinemaId("ALL");
              setFilterRoomId("ALL");
              setFilterDate("");
              setFilterStatus("ALL");
            }}
            style={{ width: "100%", padding: "9px 12px", background: "#27272a", color: "#d4d4d8", border: "1px solid #3f3f46", borderRadius: "6px", fontSize: "13px", cursor: "pointer", fontWeight: "600" }}
          >
            Đặt lại bộ lọc
          </button>
        </div>
      </div>

      {/* 4. Bảng Danh Sách Suất Chiếu */}
      <div style={{ background: "#18181b", borderRadius: "14px", border: "1px solid #27272a", overflow: "hidden" }}>
        {isLoadingShowtimes ? (
          <div style={{ textAlign: "center", padding: "80px 20px", color: "#a1a1aa" }}>
            <div style={{ fontSize: "36px", marginBottom: "12px" }}>⏳</div>
            <p>Đang tải danh sách suất chiếu...</p>
          </div>
        ) : showtimes.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <div style={{ fontSize: "44px", marginBottom: "16px" }}>🎟️</div>
            <h3 style={{ fontSize: "20px", color: "#fff", marginBottom: "8px" }}>Chưa tìm thấy suất chiếu nào</h3>
            <p style={{ color: "#a1a1aa", fontSize: "14px", maxWidth: "460px", margin: "0 auto 20px auto" }}>
              Không có suất chiếu nào khớp với bộ lọc hiện tại. Hãy tạo một suất chiếu mới cho rạp của bạn.
            </p>
            <button
              onClick={openCreateModal}
              style={{ padding: "10px 20px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "700", cursor: "pointer" }}
            >
              + Tạo Suất Chiếu Ngay
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "#27272a", color: "#a1a1aa", borderBottom: "1px solid #3f3f46", fontSize: "12px", textTransform: "uppercase" }}>
                  <th style={{ padding: "14px 18px" }}>ID</th>
                  <th style={{ padding: "14px 18px" }}>Phim</th>
                  <th style={{ padding: "14px 18px" }}>Rạp & Phòng Chiếu</th>
                  <th style={{ padding: "14px 18px" }}>Khung Giờ Chiếu</th>
                  <th style={{ padding: "14px 18px" }}>Dọn Phòng</th>
                  <th style={{ padding: "14px 18px" }}>Giá Vé Cơ Bản</th>
                  <th style={{ padding: "14px 18px" }}>Trạng Thái</th>
                  <th style={{ padding: "14px 18px", textAlign: "right" }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {showtimes.map((item) => {
                  const isScheduled = item.status === "SCHEDULED";
                  const isCancelled = item.status === "CANCELLED";

                  return (
                    <tr key={item.id} style={{ borderBottom: "1px solid #27272a", transition: "background 0.15s ease" }}>
                      <td style={{ padding: "16px 18px", color: "#71717a", fontWeight: "700" }}>#{item.id}</td>

                      <td style={{ padding: "16px 18px" }}>
                        <div style={{ fontWeight: "700", color: "#fff", fontSize: "15px" }}>
                          {item.movie?.title || `Phim ID: ${item.movieId}`}
                        </div>
                        <small style={{ color: "#a1a1aa" }}>
                          {item.movie?.durationMinutes ? `${item.movie.durationMinutes} phút` : "—"}
                        </small>
                      </td>

                      <td style={{ padding: "16px 18px" }}>
                        <div style={{ color: "#e4e4e7", fontWeight: "600" }}>
                          {item.room?.cinema?.name || "Rạp"}
                        </div>
                        <small style={{ color: "#38bdf8" }}>{item.room?.name || `Phòng ${item.roomId}`}</small>
                      </td>

                      <td style={{ padding: "16px 18px" }}>
                        <div style={{ color: "#fef08a", fontWeight: "700" }}>
                          {formatDateTime(item.startTime)}
                        </div>
                        <small style={{ color: "#a1a1aa" }}>đến {formatDateTime(item.endTime)}</small>
                      </td>

                      <td style={{ padding: "16px 18px", color: "#a1a1aa" }}>
                        {item.cleanupMinutes ?? 15} phút
                      </td>

                      <td style={{ padding: "16px 18px", color: "#34d399", fontWeight: "700" }}>
                        {Number(item.basePrice).toLocaleString("vi-VN")} đ
                      </td>

                      <td style={{ padding: "16px 18px" }}>
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: "12px",
                            fontSize: "12px",
                            fontWeight: "700",
                            background: isScheduled ? "rgba(16, 185, 129, 0.15)" : isCancelled ? "rgba(239, 68, 68, 0.15)" : "#27272a",
                            color: isScheduled ? "#10b981" : isCancelled ? "#ef4444" : "#a1a1aa",
                            border: `1px solid ${isScheduled ? "#10b981" : isCancelled ? "#ef4444" : "#3f3f46"}`,
                          }}
                        >
                          {item.status}
                        </span>
                      </td>

                      <td style={{ padding: "16px 18px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "8px" }}>
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            style={{
                              padding: "6px 12px",
                              background: "#27272a",
                              color: "#e4e4e7",
                              border: "1px solid #3f3f46",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: "600",
                              cursor: "pointer",
                            }}
                          >
                            Sửa
                          </button>

                          {isScheduled && (
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Bạn có chắc chắn muốn hủy suất chiếu #${item.id} cho phim "${item.movie?.title || ""}"?`)) {
                                  cancelMutation.mutate(item.id);
                                }
                              }}
                              disabled={cancelMutation.isPending}
                              style={{
                                padding: "6px 12px",
                                background: "rgba(239, 68, 68, 0.15)",
                                color: "#ef4444",
                                border: "1px solid #ef4444",
                                borderRadius: "6px",
                                fontSize: "12px",
                                fontWeight: "600",
                                cursor: "pointer",
                              }}
                            >
                              Hủy
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Modal Tạo / Cập Nhật Suất Chiếu */}
      {isModalOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: "14px", width: "100%", maxWidth: "560px", padding: "28px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#fff", margin: 0 }}>
                {editingShowtime ? `Cập Nhật Suất Chiếu #${editingShowtime.id}` : "+ Tạo Suất Chiếu Mới"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: "transparent", border: "none", color: "#a1a1aa", fontSize: "20px", cursor: "pointer" }}>✕</button>
            </div>

            {formError && (
              <div style={{ padding: "12px 16px", background: "#7f1d1d", color: "#fff", borderRadius: "8px", fontSize: "13px", marginBottom: "18px", border: "1px solid #dc2626" }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit}>
              {/* Chọn Phim */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#e4e4e7", marginBottom: "6px" }}>
                  1. Chọn Phim Chiếu:
                </label>
                <select
                  value={formMovieId}
                  onChange={(e) => handleFormMovieChange(Number(e.target.value))}
                  style={{ width: "100%", padding: "10px 12px", background: "#09090b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#fff", fontSize: "14px" }}
                  required
                >
                  {movies.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} ({m.durationMinutes} phút)
                    </option>
                  ))}
                </select>
              </div>

              {/* Chọn Rạp & Phòng Chiếu */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#e4e4e7", marginBottom: "6px" }}>
                    2. Rạp chiếu:
                  </label>
                  <select
                    value={formCinemaId}
                    onChange={(e) => {
                      const cid = Number(e.target.value);
                      setFormCinemaId(cid);
                      const cin = cinemas.find((c) => c.id === cid);
                      if (cin?.rooms && cin.rooms.length > 0) {
                        setFormRoomId(cin.rooms[0].id);
                      }
                    }}
                    style={{ width: "100%", padding: "10px 12px", background: "#09090b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#fff", fontSize: "14px" }}
                    required
                  >
                    {cinemas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#e4e4e7", marginBottom: "6px" }}>
                    3. Phòng chiếu:
                  </label>
                  <select
                    value={formRoomId}
                    onChange={(e) => setFormRoomId(Number(e.target.value))}
                    style={{ width: "100%", padding: "10px 12px", background: "#09090b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#fff", fontSize: "14px" }}
                    required
                  >
                    {formRooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.totalSeats ?? 0} ghế)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Thời gian Bắt đầu & Kết thúc */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#e4e4e7", marginBottom: "6px" }}>
                    Giờ Bắt Đầu (startTime):
                  </label>
                  <input
                    type="datetime-local"
                    value={formStartTime}
                    onChange={(e) => handleFormStartTimeChange(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", background: "#09090b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#fff", fontSize: "14px" }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#e4e4e7", marginBottom: "6px" }}>
                    Giờ Kết Thúc (endTime):
                  </label>
                  <input
                    type="datetime-local"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", background: "#09090b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#fff", fontSize: "14px" }}
                    required
                  />
                </div>
              </div>

              {/* Giá vé & Thời gian dọn phòng */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "24px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#e4e4e7", marginBottom: "6px" }}>
                    Giá vé cơ bản (VNĐ):
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="5000"
                    value={formBasePrice}
                    onChange={(e) => setFormBasePrice(Number(e.target.value))}
                    style={{ width: "100%", padding: "10px 12px", background: "#09090b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#fff", fontSize: "14px" }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#e4e4e7", marginBottom: "6px" }}>
                    Dọn phòng (phút):
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={formCleanupMinutes}
                    onChange={(e) => setFormCleanupMinutes(Number(e.target.value))}
                    style={{ width: "100%", padding: "10px 12px", background: "#09090b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#fff", fontSize: "14px" }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{ padding: "10px 18px", background: "#27272a", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "14px" }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  style={{
                    padding: "10px 24px",
                    background: "#f59e0b",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    fontWeight: "700",
                    fontSize: "14px",
                    cursor: createMutation.isPending || updateMutation.isPending ? "not-allowed" : "pointer",
                  }}
                >
                  {createMutation.isPending || updateMutation.isPending ? "Đang lưu..." : editingShowtime ? "Cập Nhật" : "Tạo Suất Chiếu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Modal Kiểm Tra Xung Đột Lịch Chiếu Độc Lập */}
      {isConflictCheckerOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: "14px", width: "100%", maxWidth: "560px", padding: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "24px" }}>⚡</span>
                <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#fff", margin: 0 }}>
                  Kiểm Tra Xung Đột Lịch Chiếu
                </h2>
              </div>
              <button onClick={() => setIsConflictCheckerOpen(false)} style={{ background: "transparent", border: "none", color: "#a1a1aa", fontSize: "20px", cursor: "pointer" }}>✕</button>
            </div>

            <p style={{ color: "#a1a1aa", fontSize: "13px", marginBottom: "20px" }}>
              Kiểm tra tính khả dụng của khung giờ chiếu có xét khoảng thời gian dọn phòng (<code style={{ color: "#38bdf8" }}>cleanupMinutes</code>) để chống chồng chéo lịch.
            </p>

            {conflictError && (
              <div style={{ padding: "10px 14px", background: "#7f1d1d", color: "#fff", borderRadius: "6px", fontSize: "13px", marginBottom: "16px" }}>
                {conflictError}
              </div>
            )}

            <form onSubmit={handleRunConflictCheck}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#e4e4e7", marginBottom: "4px" }}>Rạp chiếu:</label>
                  <select
                    value={checkCinemaId}
                    onChange={(e) => {
                      const cid = Number(e.target.value);
                      setCheckCinemaId(cid);
                      const cin = cinemas.find((c) => c.id === cid);
                      if (cin?.rooms && cin.rooms.length > 0) setCheckRoomId(cin.rooms[0].id);
                    }}
                    style={{ width: "100%", padding: "9px 12px", background: "#09090b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#fff", fontSize: "13px" }}
                  >
                    {cinemas.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#e4e4e7", marginBottom: "4px" }}>Phòng chiếu:</label>
                  <select
                    value={checkRoomId}
                    onChange={(e) => setCheckRoomId(Number(e.target.value))}
                    style={{ width: "100%", padding: "9px 12px", background: "#09090b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#fff", fontSize: "13px" }}
                  >
                    {checkRooms.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#e4e4e7", marginBottom: "4px" }}>Giờ Bắt Đầu:</label>
                  <input
                    type="datetime-local"
                    value={checkStartTime}
                    onChange={(e) => setCheckStartTime(e.target.value)}
                    style={{ width: "100%", padding: "9px 12px", background: "#09090b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#fff", fontSize: "13px" }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#e4e4e7", marginBottom: "4px" }}>Giờ Kết Thúc:</label>
                  <input
                    type="datetime-local"
                    value={checkEndTime}
                    onChange={(e) => setCheckEndTime(e.target.value)}
                    style={{ width: "100%", padding: "9px 12px", background: "#09090b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#fff", fontSize: "13px" }}
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#e4e4e7", marginBottom: "4px" }}>Thời gian dọn phòng (phút):</label>
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={checkCleanup}
                  onChange={(e) => setCheckCleanup(Number(e.target.value))}
                  style={{ width: "100%", padding: "9px 12px", background: "#09090b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#fff", fontSize: "13px" }}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={conflictChecking}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: "#0284c7",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "700",
                  fontSize: "14px",
                  cursor: conflictChecking ? "not-allowed" : "pointer",
                  marginBottom: "20px",
                }}
              >
                {conflictChecking ? "Đang kiểm tra..." : "🔍 Kiểm Tra Xung Đột Ngay"}
              </button>
            </form>

            {/* Kết Quả Kiểm Tra Xung Đột */}
            {conflictResult && (
              <div
                style={{
                  padding: "16px",
                  borderRadius: "8px",
                  background: conflictResult.hasConflict ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)",
                  border: `1.5px solid ${conflictResult.hasConflict ? "#ef4444" : "#10b981"}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: conflictResult.hasConflict ? "10px" : "0" }}>
                  <span style={{ fontSize: "20px" }}>{conflictResult.hasConflict ? "❌" : "✅"}</span>
                  <strong style={{ color: conflictResult.hasConflict ? "#ef4444" : "#10b981", fontSize: "15px" }}>
                    {conflictResult.hasConflict ? "PHÁT HIỆN XUNG ĐỘT THỜI GIAN!" : "KHUNG GIỜ KHẢ DỤNG!"}
                  </strong>
                </div>

                {conflictResult.hasConflict ? (
                  <div>
                    <p style={{ color: "#fca5a5", fontSize: "13px", margin: "0 0 10px 0" }}>
                      Khung giờ bạn chọn bị trùng lặp với các suất chiếu sau trong cùng phòng:
                    </p>
                    <ul style={{ margin: 0, paddingLeft: "20px", color: "#fecaca", fontSize: "13px" }}>
                      {conflictResult.conflicts?.map((c, i) => (
                        <li key={i} style={{ marginBottom: "6px" }}>
                          <strong>{c.movieTitle}</strong>:{" "}
                          {new Date(c.startTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} —{" "}
                          {new Date(c.endTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} (ID: #{c.id})
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p style={{ color: "#a7f3d0", fontSize: "13px", margin: 0 }}>
                    Phòng chiếu hoàn toàn trống trong khoảng thời gian này và đảm bảo đủ thời gian dọn phòng. Bạn có thể tiến hành tạo suất chiếu.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminShowtimesPage() {
  return (
    <Suspense fallback={<div style={{ padding: "40px", color: "#fff", textAlign: "center" }}>Đang tải giao diện quản lý suất chiếu...</div>}>
      <ShowtimesManagerContent />
    </Suspense>
  );
}
