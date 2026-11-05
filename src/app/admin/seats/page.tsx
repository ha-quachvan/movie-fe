"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminNav from "@/components/admin/AdminNav";
import {
  getCinemas,
  getSeatsByRoom,
  generateSeatsGrid,
  createSeat,
  deleteSeat,
  Room,
  Seat,
  SeatType,
  readApiError,
} from "@/lib/api";

function SeatsManagerContent() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  // URL query params nếu được chuyển từ trang Quản lý Rạp
  const initialCinemaId = searchParams.get("cinemaId");
  const initialRoomId = searchParams.get("roomId");

  // Selection states
  const [chosenCinemaId, setSelectedCinemaId] = useState<number | null>(
    initialCinemaId ? Number(initialCinemaId) : null
  );
  const [chosenRoomId, setSelectedRoomId] = useState<number | null>(
    initialRoomId ? Number(initialRoomId) : null
  );

  // Modal states
  const [isGridModalOpen, setIsGridModalOpen] = useState(false);
  const [isCreateSeatModalOpen, setIsCreateSeatModalOpen] = useState(false);
  const [selectedSeatDetail, setSelectedSeatDetail] = useState<Seat | null>(null);

  // Form states cho Generate Grid
  const [gridRowsInput, setGridRowsInput] = useState("A, B, C, D, E, F, G, H");
  const [gridColsInput, setGridColsInput] = useState(12);
  const [vipRowsInput, setVipRowsInput] = useState("E, F");
  const [gridFormError, setGridFormError] = useState("");

  // Form states cho Thêm ghế lẻ
  const [singleRow, setSingleRow] = useState("A");
  const [singleColumn, setSingleColumn] = useState(1);
  const [singleSeatNumber, setSingleSeatNumber] = useState("A1");
  const [singleType, setSingleType] = useState<SeatType>("REGULAR");
  const [singleFormError, setSingleFormError] = useState("");

  // Toast / status message
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // 1. Fetch danh sách Rạp & Phòng
  const { data: cinemas = [], isLoading: isLoadingCinemas } = useQuery({
    queryKey: ["admin-cinemas-for-seats"],
    queryFn: getCinemas,
  });
  const currentCinema = cinemas.find(cinema => cinema.id === chosenCinemaId) ?? cinemas[0] ?? null;
  const selectedCinemaId = currentCinema?.id ?? null;
  const availableRooms: Room[] = currentCinema?.rooms ?? [];
  const selectedRoomId = availableRooms.some(room => room.id === chosenRoomId)
    ? chosenRoomId : availableRooms[0]?.id ?? null;

  // 2. Fetch danh sách ghế của phòng đang chọn
  const {
    data: seats = [],
    isLoading: isLoadingSeats,
    refetch: refetchSeats,
  } = useQuery({
    queryKey: ["admin-room-seats", selectedRoomId],
    queryFn: () => (selectedRoomId ? getSeatsByRoom(selectedRoomId) : Promise.resolve([])),
    enabled: !!selectedRoomId,
  });

  // 3. Mutation: Tạo ma trận tự động
  const generateGridMutation = useMutation({
    mutationFn: generateSeatsGrid,
    onSuccess: (data) => {
      setIsGridModalOpen(false);
      setFeedbackMessage({
        text: `Khởi tạo ma trận thành công! Đã tạo ${data?.created ?? 0} ghế mới.`,
        type: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-room-seats", selectedRoomId] });
      void refetchSeats();
    },
    onError: (err) => {
      setGridFormError(readApiError(err, "Không thể tạo ma trận ghế. Vui lòng kiểm tra lại."));
    },
  });

  // 4. Mutation: Thêm ghế đơn lẻ
  const createSeatMutation = useMutation({
    mutationFn: createSeat,
    onSuccess: () => {
      setIsCreateSeatModalOpen(false);
      setFeedbackMessage({ text: "Đã thêm ghế đơn lẻ thành công!", type: "success" });
      queryClient.invalidateQueries({ queryKey: ["admin-room-seats", selectedRoomId] });
      void refetchSeats();
    },
    onError: (err) => {
      setSingleFormError(readApiError(err, "Không thể thêm ghế đơn lẻ."));
    },
  });

  // 5. Mutation: Xóa ghế
  const deleteSeatMutation = useMutation({
    mutationFn: deleteSeat,
    onSuccess: () => {
      setSelectedSeatDetail(null);
      setFeedbackMessage({ text: "Đã xóa / vô hiệu hóa ghế thành công!", type: "success" });
      queryClient.invalidateQueries({ queryKey: ["admin-room-seats", selectedRoomId] });
      void refetchSeats();
    },
    onError: (err) => {
      alert(`Lỗi khi xóa ghế: ${readApiError(err)}`);
    },
  });

  // Tính toán thống kê ghế
  const stats = useMemo(() => {
    const total = seats.length;
    const regular = seats.filter((s) => s.type === "REGULAR" && s.status !== "INACTIVE").length;
    const vip = seats.filter((s) => s.type === "VIP" && s.status !== "INACTIVE").length;
    const couple = seats.filter((s) => s.type === "COUPLE" && s.status !== "INACTIVE").length;
    const inactive = seats.filter((s) => s.status === "INACTIVE").length;
    return { total, regular, vip, couple, inactive };
  }, [seats]);

  // Phân nhóm ghế theo hàng
  const { rowList, maxCol } = useMemo(() => {
    const rowsMap = new Map<string, Seat[]>();
    let highestCol = 1;

    seats.forEach((seat) => {
      const r = seat.row.toUpperCase();
      if (!rowsMap.has(r)) rowsMap.set(r, []);
      rowsMap.get(r)!.push(seat);
      if (seat.column > highestCol) highestCol = seat.column;
    });

    // Sắp xếp các hàng chữ cái theo thứ tự A, B, C...
    const sortedRowKeys = Array.from(rowsMap.keys()).sort();
    const sortedRows = sortedRowKeys.map((r) => ({
      rowName: r,
      seats: rowsMap.get(r)!.sort((a, b) => a.column - b.column),
    }));

    return { rowList: sortedRows, maxCol: highestCol };
  }, [seats]);

  // Submit Handler: Generate Grid
  const handleGenerateGridSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoomId) return;
    setGridFormError("");

    const rows = gridRowsInput
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const cols = Number(gridColsInput);
    const vipRows = vipRowsInput
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    if (rows.length === 0) {
      setGridFormError("Vui lòng nhập ít nhất một hàng ghế.");
      return;
    }
    if (cols <= 0 || cols > 30) {
      setGridFormError("Số cột phải từ 1 đến 30.");
      return;
    }

    generateGridMutation.mutate({
      roomId: selectedRoomId,
      rows,
      colsPerRow: cols,
      vipRows,
    });
  };

  // Submit Handler: Thêm ghế đơn
  const handleCreateSingleSeat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoomId) return;
    setSingleFormError("");

    if (!singleRow.trim() || !singleSeatNumber.trim()) {
      setSingleFormError("Vui lòng điền đủ hàng ghế và mã ghế.");
      return;
    }

    createSeatMutation.mutate({
      roomId: selectedRoomId,
      row: singleRow.trim().toUpperCase(),
      column: Number(singleColumn),
      seatNumber: singleSeatNumber.trim().toUpperCase(),
      type: singleType,
      priceMultiplier: singleType === "VIP" ? 1.2 : singleType === "COUPLE" ? 1.5 : 1.0,
    });
  };

  const currentRoomName = availableRooms.find((r) => r.id === selectedRoomId)?.name || "Chưa chọn";

  return (
    <div style={{ minHeight: "100vh", background: "#0e0708", color: "#f4f4f5", padding: "24px 32px", fontFamily: "var(--font-be-vietnam), system-ui, sans-serif" }}>
      {/* 1. Thanh điều hướng Admin Tabs */}
      <AdminNav />

      {/* 2. Tiêu đề Trang & Action Buttons */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "28px" }}>💺</span>
            <h1 style={{ fontSize: "26px", fontWeight: "800", color: "#fff", margin: 0 }}>
              Quản Lý Ghế & Sơ Đồ Phòng Chiếu (UC3)
            </h1>
          </div>
          <p style={{ color: "#a1a1aa", fontSize: "14px", margin: "6px 0 0 0" }}>
            Trực quan hóa ma trận chỗ ngồi, cấu hình loại ghế (Regular/VIP/Couple) và tạo ma trận tự động
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              setSingleRow("A");
              setSingleColumn(1);
              setSingleSeatNumber("A1");
              setSingleType("REGULAR");
              setSingleFormError("");
              setIsCreateSeatModalOpen(true);
            }}
            disabled={!selectedRoomId}
            style={{
              padding: "10px 18px",
              background: "#27272a",
              color: "#fff",
              border: "1px solid #3f3f46",
              borderRadius: "8px",
              fontWeight: "600",
              fontSize: "14px",
              cursor: selectedRoomId ? "pointer" : "not-allowed",
              opacity: selectedRoomId ? 1 : 0.6,
            }}
          >
            + Thêm Ghế Đơn Lẻ
          </button>
          <button
            type="button"
            onClick={() => {
              setGridFormError("");
              setIsGridModalOpen(true);
            }}
            disabled={!selectedRoomId}
            style={{
              padding: "10px 20px",
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontWeight: "700",
              fontSize: "14px",
              cursor: selectedRoomId ? "pointer" : "not-allowed",
              opacity: selectedRoomId ? 1 : 0.6,
              boxShadow: "0 4px 14px rgba(16, 185, 129, 0.35)",
            }}
          >
            ⚡ Khởi Tạo Ma Trận Tự Động
          </button>
        </div>
      </div>

      {/* Thông báo phản hồi */}
      {feedbackMessage && (
        <div
          style={{
            padding: "12px 18px",
            borderRadius: "8px",
            marginBottom: "20px",
            background: feedbackMessage.type === "success" ? "#064e3b" : "#7f1d1d",
            color: "#fff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            border: `1px solid ${feedbackMessage.type === "success" ? "#059669" : "#dc2626"}`,
          }}
        >
          <span>{feedbackMessage.text}</span>
          <button
            onClick={() => setFeedbackMessage(null)}
            style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", fontWeight: "bold" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* 3. Bộ lọc Chọn Rạp & Chọn Phòng Chiếu */}
      <div
        style={{
          display: "flex",
          gap: "20px",
          marginBottom: "24px",
          background: "#18181b",
          padding: "18px 24px",
          borderRadius: "12px",
          border: "1px solid #27272a",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ flex: 1, minWidth: "240px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#a1a1aa", textTransform: "uppercase", marginBottom: "6px" }}>
            1. Chọn Rạp Chiếu:
          </label>
          <select
            value={selectedCinemaId || ""}
            onChange={(e) => setSelectedCinemaId(Number(e.target.value))}
            style={{
              width: "100%",
              padding: "10px 14px",
              background: "#09090b",
              border: "1px solid #3f3f46",
              borderRadius: "8px",
              color: "#fff",
              fontSize: "14px",
              outline: "none",
            }}
          >
            {isLoadingCinemas ? (
              <option>Đang tải danh sách rạp...</option>
            ) : cinemas.length === 0 ? (
              <option>Chưa có rạp nào</option>
            ) : (
              cinemas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.city})
                </option>
              ))
            )}
          </select>
        </div>

        <div style={{ flex: 1, minWidth: "240px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#a1a1aa", textTransform: "uppercase", marginBottom: "6px" }}>
            2. Chọn Phòng Chiếu Cần Cấu Hình:
          </label>
          <select
            value={selectedRoomId || ""}
            onChange={(e) => setSelectedRoomId(Number(e.target.value))}
            disabled={availableRooms.length === 0}
            style={{
              width: "100%",
              padding: "10px 14px",
              background: "#09090b",
              border: "1px solid #3f3f46",
              borderRadius: "8px",
              color: "#fff",
              fontSize: "14px",
              outline: "none",
              opacity: availableRooms.length === 0 ? 0.6 : 1,
            }}
          >
            {availableRooms.length === 0 ? (
              <option>Rạp này chưa có phòng chiếu nào</option>
            ) : (
              availableRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} (Chứa: {r.totalSeats ?? 0} ghế)
                </option>
              ))
            )}
          </select>
        </div>

        <div style={{ alignSelf: "flex-end" }}>
          <button
            type="button"
            onClick={() => void refetchSeats()}
            disabled={!selectedRoomId || isLoadingSeats}
            style={{
              padding: "10px 18px",
              background: "#27272a",
              color: "#e4e4e7",
              border: "1px solid #3f3f46",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            {isLoadingSeats ? "Đang tải..." : "Làm mới ↻"}
          </button>
        </div>
      </div>

      {/* 4. Thống kê số lượng & loại ghế */}
      {selectedRoomId && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "24px" }}>
          <div style={{ background: "#18181b", padding: "16px", borderRadius: "10px", border: "1px solid #27272a" }}>
            <span style={{ fontSize: "12px", color: "#a1a1aa", textTransform: "uppercase" }}>Tổng số ghế trong phòng</span>
            <div style={{ fontSize: "28px", fontWeight: "800", color: "#fff", marginTop: "4px" }}>{stats.total}</div>
            <span style={{ fontSize: "12px", color: "#10b981" }}>Phòng: {currentRoomName}</span>
          </div>

          <div style={{ background: "#18181b", padding: "16px", borderRadius: "10px", border: "1px solid #27272a" }}>
            <span style={{ fontSize: "12px", color: "#a1a1aa", textTransform: "uppercase" }}>Ghế Thường (Regular)</span>
            <div style={{ fontSize: "28px", fontWeight: "800", color: "#38bdf8", marginTop: "4px" }}>{stats.regular}</div>
            <span style={{ fontSize: "12px", color: "#71717a" }}>Hệ số giá: 1.0x</span>
          </div>

          <div style={{ background: "#18181b", padding: "16px", borderRadius: "10px", border: "1px solid #27272a" }}>
            <span style={{ fontSize: "12px", color: "#a1a1aa", textTransform: "uppercase" }}>Ghế VIP (1.2x)</span>
            <div style={{ fontSize: "28px", fontWeight: "800", color: "#fbbf24", marginTop: "4px" }}>{stats.vip}</div>
            <span style={{ fontSize: "12px", color: "#71717a" }}>Tỷ lệ: {stats.total ? Math.round((stats.vip / stats.total) * 100) : 0}%</span>
          </div>

          <div style={{ background: "#18181b", padding: "16px", borderRadius: "10px", border: "1px solid #27272a" }}>
            <span style={{ fontSize: "12px", color: "#a1a1aa", textTransform: "uppercase" }}>Ghế Đôi (Couple)</span>
            <div style={{ fontSize: "28px", fontWeight: "800", color: "#f472b6", marginTop: "4px" }}>{stats.couple}</div>
            <span style={{ fontSize: "12px", color: "#71717a" }}>Hệ số giá: 1.5x</span>
          </div>

          <div style={{ background: "#18181b", padding: "16px", borderRadius: "10px", border: "1px solid #27272a" }}>
            <span style={{ fontSize: "12px", color: "#a1a1aa", textTransform: "uppercase" }}>Ngừng sử dụng</span>
            <div style={{ fontSize: "28px", fontWeight: "800", color: "#ef4444", marginTop: "4px" }}>{stats.inactive}</div>
            <span style={{ fontSize: "12px", color: "#71717a" }}>Ghế vô hiệu hóa</span>
          </div>
        </div>
      )}

      {/* 5. Giao diện Sơ đồ Ma trận Ghế */}
      <div style={{ background: "#18181b", borderRadius: "14px", border: "1px solid #27272a", padding: "28px 24px", minHeight: "450px" }}>
        {!selectedRoomId ? (
          <div style={{ textAlign: "center", padding: "80px 20px", color: "#71717a" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>🏢</div>
            <h3 style={{ fontSize: "18px", color: "#a1a1aa", marginBottom: "6px" }}>Chưa chọn phòng chiếu</h3>
            <p style={{ fontSize: "14px" }}>Vui lòng chọn một rạp và phòng chiếu ở phía trên để xem sơ đồ chỗ ngồi.</p>
          </div>
        ) : isLoadingSeats ? (
          <div style={{ textAlign: "center", padding: "80px 20px", color: "#a1a1aa" }}>
            <div style={{ fontSize: "36px", marginBottom: "12px" }}>⏳</div>
            <p>Đang tải sơ đồ ghế phòng {currentRoomName}...</p>
          </div>
        ) : seats.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🪑</div>
            <h3 style={{ fontSize: "20px", color: "#fff", marginBottom: "8px" }}>Phòng chiếu chưa được thiết lập ghế</h3>
            <p style={{ color: "#a1a1aa", fontSize: "14px", maxWidth: "480px", margin: "0 auto 24px auto" }}>
              Phòng chiếu này hiện chưa có ghế nào trong CSDL. Bạn có thể sử dụng công cụ sinh tự động để tạo ngay ma trận hàng x cột chuẩn.
            </p>
            <button
              onClick={() => setIsGridModalOpen(true)}
              style={{
                padding: "12px 24px",
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontWeight: "700",
                fontSize: "15px",
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(16, 185, 129, 0.4)",
              }}
            >
              ⚡ Tạo Ma Trận Ghế Ngay
            </button>
          </div>
        ) : (
          <div>
            {/* Màn hình Screen tượng trưng */}
            <div style={{ width: "70%", maxWidth: "600px", margin: "0 auto 36px auto", textAlign: "center" }}>
              <div
                style={{
                  height: "8px",
                  background: "linear-gradient(90deg, transparent 0%, #38bdf8 50%, transparent 100%)",
                  borderRadius: "10px",
                  boxShadow: "0 0 20px #38bdf8",
                  marginBottom: "8px",
                }}
              />
              <span style={{ fontSize: "11px", letterSpacing: "3px", color: "#71717a", fontWeight: "700" }}>
                MÀN HÌNH CHIẾU PHIM (SCREEN)
              </span>
            </div>

            {/* Sơ đồ ghế cuộn ngang */}
            <div style={{ overflowX: "auto", paddingBottom: "20px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: `${maxCol * 48 + 100}px`, margin: "0 auto" }}>
                {rowList.map(({ rowName, seats: rowSeats }) => (
                  <div key={rowName} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                    <span style={{ width: "24px", textAlign: "center", fontWeight: "800", color: "#a1a1aa", fontSize: "14px" }}>
                      {rowName}
                    </span>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: `repeat(${maxCol}, 40px)`,
                        gap: "8px",
                      }}
                    >
                      {rowSeats.map((seat) => {
                        const isVip = seat.type === "VIP";
                        const isCouple = seat.type === "COUPLE";
                        const isInactive = seat.status === "INACTIVE";

                        const bgColor = isInactive
                          ? "#27272a"
                          : isVip
                          ? "rgba(251, 191, 36, 0.2)"
                          : isCouple
                          ? "rgba(244, 114, 182, 0.2)"
                          : "#1f2937";

                        const borderColor = isInactive
                          ? "#3f3f46"
                          : isVip
                          ? "#fbbf24"
                          : isCouple
                          ? "#f472b6"
                          : "#374151";

                        const textColor = isInactive ? "#71717a" : isVip ? "#fde68a" : isCouple ? "#fbcfe8" : "#e5e7eb";

                        return (
                          <button
                            key={seat.id}
                            type="button"
                            onClick={() => setSelectedSeatDetail(seat)}
                            style={{
                              gridColumn: seat.column,
                              height: "38px",
                              borderRadius: "6px",
                              background: bgColor,
                              border: `1.5px solid ${borderColor}`,
                              color: textColor,
                              fontSize: "12px",
                              fontWeight: "700",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                              transition: "transform 0.1s ease, box-shadow 0.1s ease",
                              boxShadow: isVip ? "0 0 6px rgba(251, 191, 36, 0.25)" : "none",
                            }}
                            title={`${seat.seatNumber} (${seat.type}) - Bấm để xem chi tiết hoặc xóa`}
                          >
                            <span>{seat.column}</span>
                          </button>
                        );
                      })}
                    </div>

                    <span style={{ width: "24px", textAlign: "center", fontWeight: "800", color: "#a1a1aa", fontSize: "14px" }}>
                      {rowName}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Chú thích màu sắc (Legend) */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "24px",
                marginTop: "32px",
                paddingTop: "20px",
                borderTop: "1px solid #27272a",
                flexWrap: "wrap",
                fontSize: "13px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "20px", height: "20px", background: "#1f2937", border: "1.5px solid #374151", borderRadius: "4px" }} />
                <span>Ghế thường (Regular)</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "20px", height: "20px", background: "rgba(251, 191, 36, 0.25)", border: "1.5px solid #fbbf24", borderRadius: "4px" }} />
                <span style={{ color: "#fbbf24", fontWeight: "600" }}>Ghế VIP (1.2x)</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "20px", height: "20px", background: "rgba(244, 114, 182, 0.25)", border: "1.5px solid #f472b6", borderRadius: "4px" }} />
                <span style={{ color: "#f472b6", fontWeight: "600" }}>Ghế đôi (Couple)</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "20px", height: "20px", background: "#27272a", border: "1.5px solid #3f3f46", borderRadius: "4px" }} />
                <span style={{ color: "#71717a" }}>Ngừng sử dụng (Inactive)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 6. Modal Tự Động Khởi Tạo Ma Trận (Generate Grid) */}
      {isGridModalOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: "14px", width: "100%", maxWidth: "520px", padding: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#fff", margin: 0 }}>
                ⚡ Tự Động Sinh Ma Trận Ghế
              </h2>
              <button onClick={() => setIsGridModalOpen(false)} style={{ background: "transparent", border: "none", color: "#a1a1aa", fontSize: "20px", cursor: "pointer" }}>✕</button>
            </div>

            <p style={{ color: "#a1a1aa", fontSize: "13px", marginBottom: "20px" }}>
              Cơ chế <code style={{ color: "#38bdf8" }}>INSERT IGNORE</code> sẽ tự động bổ sung các ghế chưa có mà không làm mất dữ liệu hiện tại của phòng <strong>{currentRoomName}</strong>.
            </p>

            {gridFormError && (
              <div style={{ padding: "10px 14px", background: "#7f1d1d", color: "#fff", borderRadius: "6px", fontSize: "13px", marginBottom: "16px" }}>
                {gridFormError}
              </div>
            )}

            <form onSubmit={handleGenerateGridSubmit}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#e4e4e7", marginBottom: "6px" }}>
                  Danh sách hàng ghế (cách nhau bởi dấu phẩy):
                </label>
                <input
                  type="text"
                  value={gridRowsInput}
                  onChange={(e) => setGridRowsInput(e.target.value)}
                  placeholder="Ví dụ: A, B, C, D, E, F, G, H"
                  style={{ width: "100%", padding: "10px 12px", background: "#09090b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#fff", fontSize: "14px" }}
                  required
                />
                <small style={{ color: "#71717a", fontSize: "12px", marginTop: "4px", display: "block" }}>
                  Mỗi ký tự đại diện cho 1 hàng chữ cái (từ A đến Z)
                </small>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#e4e4e7", marginBottom: "6px" }}>
                  Số lượng cột (ghế) mỗi hàng:
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={gridColsInput}
                  onChange={(e) => setGridColsInput(Number(e.target.value))}
                  style={{ width: "100%", padding: "10px 12px", background: "#09090b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#fff", fontSize: "14px" }}
                  required
                />
              </div>

              <div style={{ marginBottom: "24px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#e4e4e7", marginBottom: "6px" }}>
                  Các hàng ghế phân loại VIP (hệ số 1.2x):
                </label>
                <input
                  type="text"
                  value={vipRowsInput}
                  onChange={(e) => setVipRowsInput(e.target.value)}
                  placeholder="Ví dụ: E, F"
                  style={{ width: "100%", padding: "10px 12px", background: "#09090b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#fff", fontSize: "14px" }}
                />
                <small style={{ color: "#71717a", fontSize: "12px", marginTop: "4px", display: "block" }}>
                  Các hàng còn lại sẽ được mặc định là loại ghế Regular (thường)
                </small>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setIsGridModalOpen(false)}
                  style={{ padding: "10px 16px", background: "#27272a", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "14px" }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={generateGridMutation.isPending}
                  style={{
                    padding: "10px 20px",
                    background: "#10b981",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    fontWeight: "700",
                    fontSize: "14px",
                    cursor: generateGridMutation.isPending ? "not-allowed" : "pointer",
                  }}
                >
                  {generateGridMutation.isPending ? "Đang xử lý..." : "Khởi Tạo Ma Trận"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Modal Thêm Ghế Đơn Lẻ */}
      {isCreateSeatModalOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: "14px", width: "100%", maxWidth: "460px", padding: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#fff", margin: 0 }}>
                Thêm Ghế Đơn Lẻ
              </h2>
              <button onClick={() => setIsCreateSeatModalOpen(false)} style={{ background: "transparent", border: "none", color: "#a1a1aa", fontSize: "20px", cursor: "pointer" }}>✕</button>
            </div>

            {singleFormError && (
              <div style={{ padding: "10px 14px", background: "#7f1d1d", color: "#fff", borderRadius: "6px", fontSize: "13px", marginBottom: "16px" }}>
                {singleFormError}
              </div>
            )}

            <form onSubmit={handleCreateSingleSeat}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#e4e4e7", marginBottom: "6px" }}>
                    Hàng ghế:
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    value={singleRow}
                    onChange={(e) => {
                      const r = e.target.value.toUpperCase();
                      setSingleRow(r);
                      setSingleSeatNumber(`${r}${singleColumn}`);
                    }}
                    style={{ width: "100%", padding: "10px 12px", background: "#09090b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#fff", fontSize: "14px" }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#e4e4e7", marginBottom: "6px" }}>
                    Số cột:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={singleColumn}
                    onChange={(e) => {
                      const c = Number(e.target.value);
                      setSingleColumn(c);
                      setSingleSeatNumber(`${singleRow}${c}`);
                    }}
                    style={{ width: "100%", padding: "10px 12px", background: "#09090b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#fff", fontSize: "14px" }}
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#e4e4e7", marginBottom: "6px" }}>
                  Mã số ghế hiển thị:
                </label>
                <input
                  type="text"
                  value={singleSeatNumber}
                  onChange={(e) => setSingleSeatNumber(e.target.value.toUpperCase())}
                  placeholder="Ví dụ: A1, B12"
                  style={{ width: "100%", padding: "10px 12px", background: "#09090b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#fff", fontSize: "14px" }}
                  required
                />
              </div>

              <div style={{ marginBottom: "24px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#e4e4e7", marginBottom: "6px" }}>
                  Phân loại ghế:
                </label>
                <select
                  value={singleType}
                  onChange={(e) => setSingleType(e.target.value as SeatType)}
                  style={{ width: "100%", padding: "10px 12px", background: "#09090b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#fff", fontSize: "14px" }}
                >
                  <option value="REGULAR">Ghế thường (Regular - Hệ số 1.0x)</option>
                  <option value="VIP">Ghế VIP (VIP - Hệ số 1.2x)</option>
                  <option value="COUPLE">Ghế đôi (Couple - Hệ số 1.5x)</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setIsCreateSeatModalOpen(false)}
                  style={{ padding: "10px 16px", background: "#27272a", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "14px" }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={createSeatMutation.isPending}
                  style={{
                    padding: "10px 20px",
                    background: "#2563eb",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    fontWeight: "700",
                    fontSize: "14px",
                    cursor: createSeatMutation.isPending ? "not-allowed" : "pointer",
                  }}
                >
                  {createSeatMutation.isPending ? "Đang lưu..." : "Lưu Ghế"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. Popover / Modal Chi Tiết & Xóa Ghế */}
      {selectedSeatDetail && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: "14px", width: "100%", maxWidth: "400px", padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "24px" }}>🪑</span>
                <h3 style={{ fontSize: "18px", fontWeight: "800", color: "#fff", margin: 0 }}>
                  Ghế {selectedSeatDetail.seatNumber}
                </h3>
              </div>
              <button onClick={() => setSelectedSeatDetail(null)} style={{ background: "transparent", border: "none", color: "#a1a1aa", fontSize: "18px", cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ background: "#09090b", borderRadius: "8px", padding: "14px", marginBottom: "20px", fontSize: "13px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ color: "#a1a1aa" }}>Vị trí:</span>
                <span style={{ fontWeight: "600", color: "#fff" }}>Hàng {selectedSeatDetail.row}, Cột {selectedSeatDetail.column}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ color: "#a1a1aa" }}>Loại ghế:</span>
                <span style={{ fontWeight: "700", color: selectedSeatDetail.type === "VIP" ? "#fbbf24" : selectedSeatDetail.type === "COUPLE" ? "#f472b6" : "#38bdf8" }}>
                  {selectedSeatDetail.type} ({selectedSeatDetail.priceMultiplier ?? 1}x)
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#a1a1aa" }}>Trạng thái:</span>
                <span style={{ fontWeight: "600", color: selectedSeatDetail.status === "AVAILABLE" ? "#10b981" : "#ef4444" }}>
                  {selectedSeatDetail.status}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setSelectedSeatDetail(null)}
                style={{ flex: 1, padding: "10px", background: "#27272a", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Bạn có chắc chắn muốn xóa ghế ${selectedSeatDetail.seatNumber}? Thao tác này sẽ vô hiệu hóa ghế trong phòng.`)) {
                    deleteSeatMutation.mutate(selectedSeatDetail.id);
                  }
                }}
                disabled={deleteSeatMutation.isPending}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: "#dc2626",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: "700",
                  fontSize: "13px",
                  cursor: deleteSeatMutation.isPending ? "not-allowed" : "pointer",
                }}
              >
                {deleteSeatMutation.isPending ? "Đang xóa..." : "Xóa Ghế"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminSeatsPage() {
  return (
    <Suspense fallback={<div style={{ padding: "40px", color: "#fff", textAlign: "center" }}>Đang tải giao diện quản lý ghế...</div>}>
      <SeatsManagerContent />
    </Suspense>
  );
}
