"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCinemas,
  createCinema,
  updateCinema,
  deleteCinema,
  createRoom,
  updateRoom,
  deleteRoom,
  Cinema,
  Room,
  CreateCinemaPayload,
  UpdateCinemaPayload,
  CreateRoomPayload,
  UpdateRoomPayload,
  SeatConfig,
  readApiError,
} from "@/lib/api";
import Link from "next/link";
import AdminNav from "@/components/admin/AdminNav";

const CITIES = ["Hà Nội", "TP. Hồ Chí Minh", "Đà Nẵng", "Cần Thơ", "Hải Phòng"];

export default function AdminCinemasPage() {
  const queryClient = useQueryClient();

  // State Tìm kiếm & Lọc
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCity, setSelectedCity] = useState("ALL");

  // State Modal Rạp
  const [isCinemaModalOpen, setIsCinemaModalOpen] = useState(false);
  const [editingCinema, setEditingCinema] = useState<Cinema | null>(null);
  const [cinemaName, setCinemaName] = useState("");
  const [cinemaAddress, setCinemaAddress] = useState("");
  const [cinemaCity, setCinemaCity] = useState("Hà Nội");
  const [cinemaPhone, setCinemaPhone] = useState("");
  const [cinemaFormError, setCinemaFormError] = useState("");

  // State Modal Quản lý Phòng Chiếu
  const [activeCinemaChoice, setActiveCinemaForRooms] = useState<Cinema | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [roomName, setRoomName] = useState("");

  // State cấu hình chi tiết các loại ghế (ID 1: Thường, ID 2: VIP, ID 3: Sweetbox)
  const [standardSeats, setStandardSeats] = useState<number>(60);
  const [vipSeats, setVipSeats] = useState<number>(30);
  const [sweetboxSeats, setSweetboxSeats] = useState<number>(6);
  const [roomFormError, setRoomFormError] = useState("");

  // --- QUERY & MUTATIONS RẠP CHIẾU ---
  const { data: rawCinemas, isLoading, isError, error } = useQuery({
    queryKey: ["admin-cinemas"],
    queryFn: getCinemas,
  });

  const cinemasList: Cinema[] = Array.isArray(rawCinemas)
    ? rawCinemas
    : (rawCinemas as unknown as { data: Cinema[] })?.data &&
      Array.isArray((rawCinemas as unknown as { data: Cinema[] }).data)
    ? (rawCinemas as unknown as { data: Cinema[] }).data
    : [];

  const activeCinemaForRooms = activeCinemaChoice
    ? cinemasList.find(cinema => cinema.id === activeCinemaChoice.id) ?? null
    : null;

  const createCinemaMutation = useMutation({
    mutationFn: (payload: CreateCinemaPayload) => createCinema(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cinemas"] });
      closeCinemaModal();
      alert("Đã thêm rạp mới thành công!");
    },
    onError: (err: unknown) => setCinemaFormError(readApiError(err, "Không thể tạo rạp chiếu mới")),
  });

  const updateCinemaMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateCinemaPayload }) =>
      updateCinema(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cinemas"] });
      closeCinemaModal();
      alert("Đã cập nhật thông tin rạp thành công!");
    },
    onError: (err: unknown) => setCinemaFormError(readApiError(err, "Không thể cập nhật thông tin rạp")),
  });

  const deleteCinemaMutation = useMutation({
    mutationFn: (id: number) => deleteCinema(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cinemas"] });
      alert("Đã xóa rạp chiếu thành công!");
    },
    onError: (err: unknown) => alert(readApiError(err, "Xóa rạp thất bại")),
  });

  // --- MUTATIONS PHÒNG CHIẾU ---
  const createRoomMutation = useMutation({
    mutationFn: (payload: CreateRoomPayload) => createRoom(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cinemas"] });
      resetRoomForm();
      alert("Đã thêm phòng chiếu mới và cấu hình sơ đồ ghế!");
    },
    onError: (err: unknown) => setRoomFormError(readApiError(err, "Không thể tạo phòng chiếu")),
  });

  const updateRoomMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateRoomPayload }) =>
      updateRoom(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cinemas"] });
      resetRoomForm();
      alert("Đã cập nhật thông tin phòng chiếu!");
    },
    onError: (err: unknown) => setRoomFormError(readApiError(err, "Không thể cập nhật phòng chiếu")),
  });

  const deleteRoomMutation = useMutation({
    mutationFn: (id: number) => deleteRoom(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cinemas"] });
      alert("Đã xóa phòng chiếu!");
    },
    onError: (err: unknown) => alert(readApiError(err, "Xóa phòng thất bại")),
  });

  // --- HANDLERS RẠP ---
  const openCreateCinemaModal = () => {
    setEditingCinema(null);
    setCinemaName("");
    setCinemaAddress("");
    setCinemaCity("Hà Nội");
    setCinemaPhone("");
    setCinemaFormError("");
    setIsCinemaModalOpen(true);
  };

  const openEditCinemaModal = (cinema: Cinema) => {
    setEditingCinema(cinema);
    setCinemaName(cinema.name);
    setCinemaAddress(cinema.address);
    setCinemaCity(cinema.city);
    setCinemaPhone(cinema.phone || "");
    setCinemaFormError("");
    setIsCinemaModalOpen(true);
  };

  const closeCinemaModal = () => {
    setIsCinemaModalOpen(false);
    setEditingCinema(null);
  };

  const handleCinemaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCinemaFormError("");

    if (!cinemaName.trim() || !cinemaAddress.trim()) {
      setCinemaFormError("Vui lòng điền đầy đủ Tên rạp và Địa chỉ.");
      return;
    }

    const payload: CreateCinemaPayload = {
      name: cinemaName,
      address: cinemaAddress,
      city: cinemaCity,
      phone: cinemaPhone || undefined,
    };

    if (editingCinema) {
      updateCinemaMutation.mutate({ id: editingCinema.id, payload });
    } else {
      createCinemaMutation.mutate(payload);
    }
  };

  const handleDeleteCinema = (id: number, name: string) => {
    if (confirm(`Bạn có chắc chắn muốn xóa rạp "${name}"? Thao tác này có thể ảnh hưởng đến các phòng chiếu thuộc rạp.`)) {
      deleteCinemaMutation.mutate(id);
    }
  };

  // --- HANDLERS PHÒNG CHIẾU ---
  const openRoomsManager = (cinema: Cinema) => {
    setActiveCinemaForRooms(cinema);
    resetRoomForm();
  };

  const resetRoomForm = () => {
    setEditingRoom(null);
    setRoomName("");
    setStandardSeats(60);
    setVipSeats(30);
    setSweetboxSeats(6);
    setRoomFormError("");
  };

  const handleEditRoomClick = (room: Room) => {
    setEditingRoom(room);
    setRoomName(room.name);

    const total = room.totalSeats ?? room.capacity ?? 96;
    setStandardSeats(Math.round(total * 0.6));
    setVipSeats(Math.round(total * 0.3));
    setSweetboxSeats(total - Math.round(total * 0.6) - Math.round(total * 0.3));
    setRoomFormError("");
  };

  const handleRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCinemaForRooms) return;
    setRoomFormError("");

    if (!roomName.trim()) {
      setRoomFormError("Vui lòng nhập tên phòng chiếu.");
      return;
    }

    const std = Number(standardSeats) || 0;
    const vip = Number(vipSeats) || 0;
    const sweet = Number(sweetboxSeats) || 0;
    const total = std + vip + sweet;

    if (total <= 0) {
      setRoomFormError("Tổng số lượng ghế phải lớn hơn 0.");
      return;
    }

    const seatConfigurations: SeatConfig[] = [];
    if (std > 0) seatConfigurations.push({ seatTypeId: 1, totalSeats: std });
    if (vip > 0) seatConfigurations.push({ seatTypeId: 2, totalSeats: vip });
    if (sweet > 0) seatConfigurations.push({ seatTypeId: 3, totalSeats: sweet });

    if (editingRoom) {
      updateRoomMutation.mutate({
        id: editingRoom.id,
        payload: {
          name: roomName,
          totalSeats: total,
          seatConfigurations,
        },
      });
    } else {
      createRoomMutation.mutate({
        name: roomName,
        totalSeats: total,
        cinemaId: Number(activeCinemaForRooms.id),
        seatConfigurations,
      });
    }
  };

  const handleDeleteRoom = (roomId: number, name: string) => {
    if (confirm(`Xóa phòng chiếu "${name}"?`)) {
      deleteRoomMutation.mutate(roomId);
    }
  };

  const filteredCinemas = cinemasList.filter((c) => {
    const matchSearch =
      (c.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.address || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchCity = selectedCity === "ALL" || c.city === selectedCity;
    return matchSearch && matchCity;
  });

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "32px 24px", color: "#111827", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Admin Navigation */}
      <AdminNav />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: "800", color: "#292e36", margin: 0, letterSpacing: "-0.02em" }}>
            Quản Lý Cụm Rạp & Phòng Chiếu
          </h1>
          <p style={{ color: "#404247", fontSize: "14px", margin: "6px 0 0 0" }}>
            Thêm, sửa, xóa danh sách rạp và cấu hình các phòng chiếu trực thuộc
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <Link
            href="/"
            style={{
              padding: "10px 18px",
              background: "#1f2937",
              color: "#f9fafb",
              textDecoration: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "600",
              border: "1px solid #374151",
            }}
          >
            ← Trang chủ
          </Link>
          <button
            onClick={openCreateCinemaModal}
            style={{
              padding: "10px 20px",
              background: "#e50914",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontWeight: "700",
              fontSize: "14px",
              cursor: "pointer",
              boxShadow: "0 2px 10px rgba(229, 9, 20, 0.3)",
            }}
          >
            + Thêm Rạp Mới
          </button>
        </div>
      </div>

      {/* Thanh Tìm Kiếm & Lọc Thành Phố */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "20px", background: "#18181b", padding: "14px 18px", borderRadius: "10px", border: "1px solid #27272a" }}>
        <input
          type="text"
          placeholder="🔍 Tìm tên rạp hoặc địa chỉ..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: 1, padding: "9px 14px", background: "#09090b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#fff", fontSize: "14px" }}
        />
        <select
          value={selectedCity}
          onChange={(e) => setSelectedCity(e.target.value)}
          style={{ padding: "9px 14px", background: "#09090b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#fff", fontSize: "14px" }}
        >
          <option value="ALL">Tất cả thành phố</option>
          {CITIES.map((city) => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>
      </div>

      {/* Bảng Danh Sách Rạp Chiếu */}
      {isLoading ? (
        <p style={{ color: "#9ca3af", textAlign: "center", padding: "40px" }}>Đang tải danh sách rạp chiếu…</p>
      ) : isError ? (
        <p style={{ color: "#f87171", textAlign: "center", padding: "40px" }}>Lỗi tải dữ liệu: {(error as Error).message}</p>
      ) : (
        <div style={{ background: "#18181b", borderRadius: "12px", border: "1px solid #27272a", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px", color: "#f3f4f6" }}>
            <thead>
              <tr style={{ background: "#27272a", color: "#9ca3af", textTransform: "uppercase", fontSize: "12px", letterSpacing: "0.05em" }}>
                <th style={{ padding: "14px 16px" }}>ID</th>
                <th style={{ padding: "14px 16px" }}>Tên rạp</th>
                <th style={{ padding: "14px 16px" }}>Địa chỉ</th>
                <th style={{ padding: "14px 16px" }}>Thành phố</th>
                <th style={{ padding: "14px 16px" }}>Số điện thoại</th>
                <th style={{ padding: "14px 16px" }}>Số phòng</th>
                <th style={{ padding: "14px 16px", textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredCinemas.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "#71717a" }}>
                    Chưa có rạp chiếu nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredCinemas.map((cinema) => {
                  const roomCount = cinema.rooms?.length ?? cinema._count?.rooms ?? 0;
                  return (
                    <tr key={cinema.id} style={{ borderBottom: "1px solid #27272a" }}>
                      <td style={{ padding: "14px 16px", color: "#9ca3af", fontWeight: "600" }}>#{cinema.id}</td>
                      <td style={{ padding: "14px 16px", fontWeight: "700", color: "#ffffff" }}>{cinema.name}</td>
                      <td style={{ padding: "14px 16px", color: "#d1d5db", maxWidth: "300px" }}>{cinema.address}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "600", background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa", border: "1px solid rgba(59, 130, 246, 0.3)" }}>
                          {cinema.city}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", color: "#a1a1aa" }}>{cinema.phone || "—"}</td>
                      <td style={{ padding: "14px 16px", fontWeight: "600" }}>{roomCount} phòng</td>
                      <td style={{ padding: "14px 16px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "8px" }}>
                          <button
                            onClick={() => openRoomsManager(cinema)}
                            style={{ padding: "6px 12px", background: "#059669", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}
                          >
                            🚪 Quản lý phòng ({roomCount})
                          </button>
                          <button
                            onClick={() => openEditCinemaModal(cinema)}
                            style={{ padding: "6px 12px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}
                          >
                            Sửa
                          </button>
                          <button
                            onClick={() => handleDeleteCinema(cinema.id, cinema.name)}
                            style={{ padding: "6px 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}
                          >
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <div style={{ padding: "12px 16px", background: "#27272a", color: "#a1a1aa", fontSize: "13px", borderTop: "1px solid #3f3f46" }}>
            Hiển thị <strong>{filteredCinemas.length}</strong> / <strong>{cinemasList.length}</strong> cụm rạp
          </div>
        </div>
      )}

      {/* MODAL THÊM / SỬA RẠP CHIẾU */}
      {isCinemaModalOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px", backdropFilter: "blur(4px)" }}>
          <div style={{ background: "#18181b", padding: "28px", borderRadius: "14px", width: "100%", maxWidth: "540px", border: "1px solid #3f3f46", color: "#f3f4f6" }}>
            <h2 style={{ margin: "0 0 20px 0", fontSize: "20px", fontWeight: "700", color: "#fff" }}>
              {editingCinema ? `Sửa Rạp Chiếu (ID: #${editingCinema.id})` : "Thêm Rạp Chiếu Mới"}
            </h2>

            {cinemaFormError && (
              <p style={{ background: "rgba(220, 38, 38, 0.2)", color: "#f87171", border: "1px solid rgba(220, 38, 38, 0.4)", padding: "10px 14px", borderRadius: "8px", marginBottom: "16px", fontSize: "14px" }}>
                {cinemaFormError}
              </p>
            )}

            <form onSubmit={handleCinemaSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: "500", color: "#d4d4d8" }}>Tên rạp *</label>
                <input
                  type="text"
                  placeholder="VD: CineFlow Cầu Giấy"
                  value={cinemaName}
                  onChange={(e) => setCinemaName(e.target.value)}
                  style={{ width: "100%", padding: "10px", background: "#09090b", border: "1px solid #3f3f46", color: "#fff", borderRadius: "8px", fontSize: "14px" }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: "500", color: "#d4d4d8" }}>Địa chỉ chi tiết *</label>
                <input
                  type="text"
                  placeholder="VD: Tầng 4, Discovery Complex, 302 Cầu Giấy"
                  value={cinemaAddress}
                  onChange={(e) => setCinemaAddress(e.target.value)}
                  style={{ width: "100%", padding: "10px", background: "#09090b", border: "1px solid #3f3f46", color: "#fff", borderRadius: "8px", fontSize: "14px" }}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: "500", color: "#d4d4d8" }}>Thành phố</label>
                  <select
                    value={cinemaCity}
                    onChange={(e) => setCinemaCity(e.target.value)}
                    style={{ width: "100%", padding: "10px", background: "#09090b", border: "1px solid #3f3f46", color: "#fff", borderRadius: "8px", fontSize: "14px" }}
                  >
                    {CITIES.map((city) => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: "500", color: "#d4d4d8" }}>Số điện thoại</label>
                  <input
                    type="text"
                    placeholder="VD: 024 7300 8899"
                    value={cinemaPhone}
                    onChange={(e) => setCinemaPhone(e.target.value)}
                    style={{ width: "100%", padding: "10px", background: "#09090b", border: "1px solid #3f3f46", color: "#fff", borderRadius: "8px", fontSize: "14px" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={closeCinemaModal}
                  style={{ padding: "10px 18px", background: "#27272a", color: "#e4e4e7", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "14px" }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={createCinemaMutation.isPending || updateCinemaMutation.isPending}
                  style={{ padding: "10px 22px", background: "#e50914", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "600", fontSize: "14px", cursor: "pointer" }}
                >
                  {createCinemaMutation.isPending || updateCinemaMutation.isPending ? "Đang lưu…" : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL QUẢN LÝ PHÒNG CHIẾU CỦA RẠP */}
      {activeCinemaForRooms && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px", backdropFilter: "blur(4px)" }}>
          <div style={{ background: "#18181b", padding: "28px", borderRadius: "14px", width: "100%", maxWidth: "840px", maxHeight: "90vh", overflowY: "auto", border: "1px solid #3f3f46", color: "#f3f4f6" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: "1px solid #27272a", paddingBottom: "12px" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#fff" }}>
                  Quản lý phòng chiếu: <span style={{ color: "#38bdf8" }}>{activeCinemaForRooms.name}</span>
                </h2>
                <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#9ca3af" }}>{activeCinemaForRooms.address}</p>
              </div>
              <button
                onClick={() => setActiveCinemaForRooms(null)}
                style={{ padding: "6px 14px", background: "#3f3f46", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}
              >
                ✕ Đóng
              </button>
            </div>

            {/* Form Thêm/Sửa Phòng Chiếu */}
            <form onSubmit={handleRoomSubmit} style={{ background: "#09090b", padding: "18px", borderRadius: "10px", border: "1px solid #27272a", marginBottom: "24px" }}>
              <h3 style={{ margin: "0 0 14px 0", fontSize: "15px", fontWeight: "600", color: "#f3f4f6" }}>
                {editingRoom ? `Sửa Cấu Hình Phòng: ${editingRoom.name}` : "+ Thêm Phòng Chiếu Mới"}
              </h3>

              {roomFormError && (
                <p style={{ background: "rgba(220, 38, 38, 0.2)", color: "#f87171", border: "1px solid rgba(220, 38, 38, 0.4)", padding: "8px 12px", borderRadius: "6px", fontSize: "13px", marginBottom: "12px" }}>
                  {roomFormError}
                </p>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "4px", fontSize: "12px", color: "#a1a1aa" }}>Tên phòng *</label>
                  <input
                    type="text"
                    placeholder="VD: Screen 01, IMAX Laser"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", background: "#18181b", border: "1px solid #3f3f46", color: "#fff", borderRadius: "6px", fontSize: "14px" }}
                    required
                  />
                </div>

                {/* Cấu hình số lượng từng loại ghế */}
                <div style={{ background: "#18181b", padding: "12px 14px", borderRadius: "8px", border: "1px solid #27272a" }}>
                  <label style={{ display: "block", marginBottom: "10px", fontSize: "13px", fontWeight: "600", color: "#38bdf8" }}>
                    Cấu hình Phân Loại Ghế trong Phòng
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ display: "block", marginBottom: "4px", fontSize: "12px", color: "#a1a1aa" }}>Ghế Thường (Standard)</label>
                      <input
                        type="number"
                        min="0"
                        value={standardSeats}
                        onChange={(e) => setStandardSeats(Number(e.target.value))}
                        style={{ width: "100%", padding: "8px 10px", background: "#09090b", border: "1px solid #3f3f46", color: "#fff", borderRadius: "6px", fontSize: "14px" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", marginBottom: "4px", fontSize: "12px", color: "#a1a1aa" }}>Ghế VIP</label>
                      <input
                        type="number"
                        min="0"
                        value={vipSeats}
                        onChange={(e) => setVipSeats(Number(e.target.value))}
                        style={{ width: "100%", padding: "8px 10px", background: "#09090b", border: "1px solid #3f3f46", color: "#fff", borderRadius: "6px", fontSize: "14px" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", marginBottom: "4px", fontSize: "12px", color: "#a1a1aa" }}>Ghế Đôi (Sweetbox)</label>
                      <input
                        type="number"
                        min="0"
                        value={sweetboxSeats}
                        onChange={(e) => setSweetboxSeats(Number(e.target.value))}
                        style={{ width: "100%", padding: "8px 10px", background: "#09090b", border: "1px solid #3f3f46", color: "#fff", borderRadius: "6px", fontSize: "14px" }}
                      />
                    </div>
                  </div>
                  <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "#a1a1aa", textAlign: "right" }}>
                    Tổng sức chứa tự động tính: <strong style={{ color: "#10b981", fontSize: "14px" }}>{(Number(standardSeats) || 0) + (Number(vipSeats) || 0) + (Number(sweetboxSeats) || 0)}</strong> ghế
                  </p>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                  {editingRoom && (
                    <button type="button" onClick={resetRoomForm} style={{ padding: "9px 16px", background: "#3f3f46", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>
                      Hủy Sửa
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={createRoomMutation.isPending || updateRoomMutation.isPending}
                    style={{ padding: "9px 20px", background: "#059669", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "600", cursor: "pointer", fontSize: "13px" }}
                  >
                    {createRoomMutation.isPending || updateRoomMutation.isPending ? "Đang lưu..." : editingRoom ? "Cập nhật cấu hình" : "Thêm phòng"}
                  </button>
                </div>
              </div>
            </form>

            {/* Danh sách phòng hiện có */}
            <h3 style={{ margin: "0 0 12px 0", fontSize: "15px", fontWeight: "600" }}>Danh sách phòng chiếu hiện tại</h3>
            {(!activeCinemaForRooms.rooms || activeCinemaForRooms.rooms.length === 0) ? (
              <p style={{ color: "#71717a", textAlign: "center", padding: "20px 0" }}>Rạp này chưa có phòng chiếu nào. Hãy thêm phòng chiếu ở form trên.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
                <thead>
                  <tr style={{ background: "#27272a", color: "#a1a1aa", textTransform: "uppercase", fontSize: "12px" }}>
                    <th style={{ padding: "10px 14px" }}>ID</th>
                    <th style={{ padding: "10px 14px" }}>Tên phòng</th>
                    <th style={{ padding: "10px 14px" }}>Sức chứa</th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {activeCinemaForRooms.rooms.map((room) => (
                    <tr key={room.id} style={{ borderBottom: "1px solid #27272a" }}>
                      <td style={{ padding: "10px 14px", color: "#71717a" }}>#{room.id}</td>
                      <td style={{ padding: "10px 14px", fontWeight: "600", color: "#fff" }}>{room.name}</td>
                      <td style={{ padding: "10px 14px", color: "#d1d5db" }}>{room.totalSeats ?? room.capacity} ghế</td>
                      <td style={{ padding: "10px 14px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "8px", alignItems: "center" }}>
                          <Link
                            href={`/admin/seats?cinemaId=${activeCinemaForRooms.id}&roomId=${room.id}`}
                            style={{
                              padding: "4px 10px",
                              background: "#059669",
                              color: "#fff",
                              textDecoration: "none",
                              borderRadius: "4px",
                              fontSize: "12px",
                              fontWeight: "600",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            💺 Sơ đồ ghế
                          </Link>
                          <button
                            onClick={() => handleEditRoomClick(room)}
                            style={{ padding: "4px 10px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}
                          >
                            Sửa
                          </button>
                          <button
                            onClick={() => handleDeleteRoom(room.id, room.name)}
                            style={{ padding: "4px 10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}
                          >
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}