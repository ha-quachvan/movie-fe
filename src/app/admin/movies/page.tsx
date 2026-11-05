"use client";

import Image from "next/image";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getMovies,
  createMovie,
  updateMovie,
  deleteMovie,
  Movie,
  MovieStatusEnum,
  CreateMoviePayload,
  UpdateMoviePayload,
} from "@/lib/api";
import Link from "next/link";
import AdminNav from "@/components/admin/AdminNav";

const GENRE_OPTIONS = [
  { id: 1, name: "Khoa học viễn tưởng" },
  { id: 2, name: "Phiêu lưu" },
  { id: 3, name: "Tiểu sử" },
  { id: 4, name: "Lịch sử" },
  { id: 5, name: "Chính kịch" },
  { id: 6, name: "Hành động" },
  { id: 7, name: "Hài hước" },
  { id: 8, name: "Siêu anh hùng" },
  { id: 9, name: "Quái thú" },
  { id: 10, name: "Giả tưởng" },
  { id: 11, name: "Hoạt hình" },
  { id: 12, name: "Gia đình" },
  { id: 13, name: "Giật gân" },
];

export default function AdminMoviesPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMovie, setEditingMovie] = useState<Movie | null>(null);
  const [formError, setFormError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  // Form States
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [releaseDate, setReleaseDate] = useState("2026-12-05");
  const [ageRating, setAgeRating] = useState("P");
  const [director, setDirector] = useState("");
  const [cast, setCast] = useState("");
  const [posterUrl, setPosterUrl] = useState("");
  const [trailerUrl, setTrailerUrl] = useState("");
  const [status, setStatus] = useState<MovieStatusEnum>("COMING_SOON");
  const [rating, setRating] = useState(8.0);
  const [selectedGenreIds, setSelectedGenreIds] = useState<number[]>([]);

  const { data: movies = [], isLoading, isError, error } = useQuery({
    queryKey: ["admin-movies"],
    queryFn: getMovies,
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateMoviePayload) => createMovie(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-movies"] });
      closeModal();
      alert("Đã thêm phim mới thành công!");
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateMoviePayload }) =>
      updateMovie(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-movies"] });
      closeModal();
      alert("Đã cập nhật thông tin phim thành công!");
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteMovie(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-movies"] });
      alert("Đã xóa phim thành công!");
    },
    onError: (err: Error) => alert(`Xóa phim thất bại: ${err.message}`),
  });

  const openCreateModal = () => {
    setEditingMovie(null);
    setTitle("");
    setDescription("");
    setDurationMinutes(120);
    setReleaseDate("2026-12-05");
    setAgeRating("C13");
    setDirector("");
    setCast("");
    setPosterUrl("");
    setTrailerUrl("");
    setStatus("COMING_SOON");
    setRating(8.0);
    setSelectedGenreIds([6]);
    setFormError("");
    setIsModalOpen(true);
  };

  const openEditModal = (movie: Movie) => {
    setEditingMovie(movie);
    setTitle(movie.title);
    setDescription(movie.description || "");
    setDurationMinutes(movie.durationMinutes || 120);
    setReleaseDate(movie.releaseDate ? movie.releaseDate.substring(0, 10) : "2026-12-05");
    setAgeRating(movie.ageRating || "P");
    setDirector(movie.director || "");
    setCast(movie.cast || "");
    setPosterUrl(movie.posterUrl || "");
    setTrailerUrl(movie.trailerUrl || "");
    setStatus((movie.status as MovieStatusEnum) || "NOW_SHOWING");
    setRating(Number(movie.rating) || 8.0);
    setSelectedGenreIds(movie.genres?.map((g) => g.id) || []);
    setFormError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingMovie(null);
  };

  const toggleGenre = (genreId: number) => {
    setSelectedGenreIds((prev) =>
      prev.includes(genreId) ? prev.filter((id) => id !== genreId) : [...prev, genreId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!title.trim()) {
      setFormError("Vui lòng nhập tên phim.");
      return;
    }

    const payload: CreateMoviePayload = {
      title,
      description: description || undefined,
      durationMinutes: Number(durationMinutes),
      releaseDate,
      ageRating,
      director,
      cast,
      posterUrl,
      trailerUrl,
      status,
      rating: Number(rating),
      genreIds: selectedGenreIds,
    };

    if (editingMovie) {
      updateMutation.mutate({ id: editingMovie.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (id: number, title: string) => {
    if (confirm(`Bạn có chắc chắn muốn xóa phim "${title}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  // Lọc phim theo từ khóa và trạng thái
  const filteredMovies = movies.filter((m) => {
    const matchTitle = m.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === "ALL" || m.status === filterStatus;
    return matchTitle && matchStatus;
  });

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "32px 24px", color: "#f3f4f6", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Admin Navigation */}
      <AdminNav />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
        <div>
          <h1 style={{ color: "#292e36", fontSize: "26px", fontWeight: "700", margin: 0, letterSpacing: "-0.02em" }}>Quản Lý Danh Sách Phim</h1>
          <p style={{ color: "#404247", fontSize: "14px", margin: "6px 0 0 0" }}>Hệ thống quản trị dữ liệu phim dành cho Admin</p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <Link
            href="/movies"
            style={{
              padding: "10px 18px",
              background: "#27272a",
              color: "#e4e4e7",
              textDecoration: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "500",
              border: "1px solid #3f3f46",
              transition: "background 0.2s",
            }}
          >
            ← Trang khách hàng
          </Link>
          <button
            onClick={openCreateModal}
            style={{
              padding: "10px 20px",
              background: "#e50914",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontWeight: "600",
              fontSize: "14px",
              cursor: "pointer",
              boxShadow: "0 2px 10px rgba(229, 9, 20, 0.3)",
            }}
          >
            + Thêm Phim Mới
          </button>
        </div>
      </div>

      {/* Thanh Lọc & Tìm Kiếm */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "20px", background: "#18181b", padding: "14px 18px", borderRadius: "10px", border: "1px solid #27272a" }}>
        <input
          type="text"
          placeholder="🔍 Tìm theo tên phim..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: 1,
            padding: "9px 14px",
            background: "#09090b",
            border: "1px solid #3f3f46",
            borderRadius: "6px",
            color: "#fff",
            fontSize: "14px",
          }}
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{
            padding: "9px 14px",
            background: "#09090b",
            border: "1px solid #3f3f46",
            borderRadius: "6px",
            color: "#fff",
            fontSize: "14px",
          }}
        >
          <option value="ALL">Tất cả trạng thái</option>
          <option value="NOW_SHOWING">Đang chiếu</option>
          <option value="COMING_SOON">Sắp chiếu</option>
        </select>
      </div>

      {/* Bảng Danh Sách Phim */}
      {isLoading ? (
        <p style={{ color: "#a1a1aa", textAlign: "center", padding: "40px" }}>Đang tải danh sách phim…</p>
      ) : isError ? (
        <p style={{ color: "#f87171", textAlign: "center", padding: "40px" }}>Lỗi tải dữ liệu: {(error as Error).message}</p>
      ) : (
        <div style={{ background: "#18181b", borderRadius: "12px", border: "1px solid #27272a", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
            <thead>
              <tr style={{ background: "#27272a", color: "#a1a1aa", textTransform: "uppercase", fontSize: "12px", letterSpacing: "0.05em" }}>
                <th style={{ padding: "14px 16px" }}>ID</th>
                <th style={{ padding: "14px 16px" }}>Poster</th>
                <th style={{ padding: "14px 16px" }}>Tên phim</th>
                <th style={{ padding: "14px 16px" }}>Đạo diễn</th>
                <th style={{ padding: "14px 16px" }}>Thời lượng</th>
                <th style={{ padding: "14px 16px" }}>Trạng thái</th>
                <th style={{ padding: "14px 16px" }}>Đánh giá</th>
                <th style={{ padding: "14px 16px", textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredMovies.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: "32px", textAlign: "center", color: "#71717a" }}>
                    Không tìm thấy phim nào khớp với điều kiện.
                  </td>
                </tr>
              ) : (
                filteredMovies.map((movie) => (
                  <tr key={movie.id} style={{ borderBottom: "1px solid #27272a" }}>
                    <td style={{ padding: "14px 16px", color: "#71717a", fontWeight: "600" }}>#{movie.id}</td>
                    <td style={{ padding: "14px 16px" }}>
                      <Image unoptimized width={42} height={60}
                        src={movie.posterUrl || "https://via.placeholder.com/45x65"}
                        alt={movie.title}
                        style={{ width: "42px", height: "60px", objectFit: "cover", borderRadius: "6px", border: "1px solid #3f3f46" }}
                      />
                    </td>
                    <td style={{ padding: "14px 16px", fontWeight: "600", color: "#f4f4f5" }}>{movie.title}</td>
                    <td style={{ padding: "14px 16px", color: "#a1a1aa" }}>{movie.director || "—"}</td>
                    <td style={{ padding: "14px 16px" }}>{movie.durationMinutes} phút</td>
                    <td style={{ padding: "14px 16px" }}>
                      <span
                        style={{
                          padding: "4px 10px",
                          borderRadius: "20px",
                          fontSize: "12px",
                          fontWeight: "600",
                          background: movie.status === "NOW_SHOWING" ? "rgba(34, 197, 94, 0.15)" : "rgba(234, 179, 8, 0.15)",
                          color: movie.status === "NOW_SHOWING" ? "#4ade80" : "#facc15",
                          border: `1px solid ${movie.status === "NOW_SHOWING" ? "rgba(34, 197, 94, 0.3)" : "rgba(234, 179, 8, 0.3)"}`,
                        }}
                      >
                        {movie.status === "NOW_SHOWING" ? "Đang chiếu" : "Sắp chiếu"}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", fontWeight: "600", color: "#facc15" }}>★ {movie.rating || "—"}</td>
                    <td style={{ padding: "14px 16px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "8px" }}>
                        <button
                          onClick={() => openEditModal(movie)}
                          style={{ padding: "6px 14px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "500" }}
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => handleDelete(movie.id, movie.title)}
                          style={{ padding: "6px 14px", background: "#dc2626", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "500" }}
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div style={{ padding: "12px 16px", background: "#27272a", color: "#a1a1aa", fontSize: "13px", borderTop: "1px solid #3f3f46" }}>
            Hiển thị <strong>{filteredMovies.length}</strong> / <strong>{movies.length}</strong> phim
          </div>
        </div>
      )}

      {/* Modal Form */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            style={{
              background: "#18181b",
              padding: "28px",
              borderRadius: "14px",
              width: "100%",
              maxWidth: "700px",
              maxHeight: "90vh",
              overflowY: "auto",
              border: "1px solid #3f3f46",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
            }}
          >
            <h2 style={{ margin: "0 0 20px 0", fontSize: "20px", fontWeight: "700" }}>
              {editingMovie ? `Sửa thông tin phim (ID: ${editingMovie.id})` : "Thêm phim mới"}
            </h2>

            {formError && (
              <p style={{ background: "rgba(220, 38, 38, 0.2)", color: "#f87171", border: "1px solid rgba(220, 38, 38, 0.4)", padding: "10px 14px", borderRadius: "8px", marginBottom: "16px", fontSize: "14px" }}>
                {formError}
              </p>
            )}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: "500", color: "#d4d4d8" }}>Tên phim *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{ width: "100%", padding: "10px", background: "#09090b", border: "1px solid #3f3f46", color: "#fff", borderRadius: "8px", fontSize: "14px" }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: "500", color: "#d4d4d8" }}>Mô tả phim</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  style={{ width: "100%", padding: "10px", background: "#09090b", border: "1px solid #3f3f46", color: "#fff", borderRadius: "8px", fontSize: "14px" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: "500", color: "#d4d4d8" }}>Thời lượng (phút)</label>
                  <input
                    type="number"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    style={{ width: "100%", padding: "10px", background: "#09090b", border: "1px solid #3f3f46", color: "#fff", borderRadius: "8px", fontSize: "14px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: "500", color: "#d4d4d8" }}>Trạng thái</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as MovieStatusEnum)}
                    style={{ width: "100%", padding: "10px", background: "#09090b", border: "1px solid #3f3f46", color: "#fff", borderRadius: "8px", fontSize: "14px" }}
                  >
                    <option value="NOW_SHOWING">Đang chiếu (NOW_SHOWING)</option>
                    <option value="COMING_SOON">Sắp chiếu (COMING_SOON)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: "500", color: "#d4d4d8" }}>Ngày khởi chiếu</label>
                  <input
                    type="date"
                    value={releaseDate}
                    onChange={(e) => setReleaseDate(e.target.value)}
                    style={{ colorScheme: "dark", width: "100%", padding: "10px", background: "#09090b", border: "1px solid #3f3f46", color: "#fff", borderRadius: "8px", fontSize: "14px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: "500", color: "#d4d4d8" }}>Độ tuổi (Age Rating)</label>
                  <input
                    type="text"
                    value={ageRating}
                    onChange={(e) => setAgeRating(e.target.value)}
                    placeholder="VD: P, C13, C16, C18"
                    style={{ width: "100%", padding: "10px", background: "#09090b", border: "1px solid #3f3f46", color: "#fff", borderRadius: "8px", fontSize: "14px" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: "500", color: "#d4d4d8" }}>Đạo diễn</label>
                  <input
                    type="text"
                    value={director}
                    onChange={(e) => setDirector(e.target.value)}
                    style={{ width: "100%", padding: "10px", background: "#09090b", border: "1px solid #3f3f46", color: "#fff", borderRadius: "8px", fontSize: "14px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: "500", color: "#d4d4d8" }}>Điểm đánh giá</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                    style={{ width: "100%", padding: "10px", background: "#09090b", border: "1px solid #3f3f46", color: "#fff", borderRadius: "8px", fontSize: "14px" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: "500", color: "#d4d4d8" }}>Diễn viên chính</label>
                <input
                  type="text"
                  value={cast}
                  onChange={(e) => setCast(e.target.value)}
                  style={{ width: "100%", padding: "10px", background: "#09090b", border: "1px solid #3f3f46", color: "#fff", borderRadius: "8px", fontSize: "14px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: "500", color: "#d4d4d8" }}>Poster URL</label>
                <input
                  type="text"
                  value={posterUrl}
                  onChange={(e) => setPosterUrl(e.target.value)}
                  style={{ width: "100%", padding: "10px", background: "#09090b", border: "1px solid #3f3f46", color: "#fff", borderRadius: "8px", fontSize: "14px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: "500", color: "#d4d4d8" }}>Trailer URL (YouTube)</label>
                <input
                  type="text"
                  value={trailerUrl}
                  onChange={(e) => setTrailerUrl(e.target.value)}
                  style={{ width: "100%", padding: "10px", background: "#09090b", border: "1px solid #3f3f46", color: "#fff", borderRadius: "8px", fontSize: "14px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: "500", color: "#d4d4d8" }}>Thể loại</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", maxHeight: "110px", overflowY: "auto", padding: "10px", background: "#09090b", border: "1px solid #3f3f46", borderRadius: "8px" }}>
                  {GENRE_OPTIONS.map((g) => {
                    const active = selectedGenreIds.includes(g.id);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => toggleGenre(g.id)}
                        style={{
                          padding: "4px 10px",
                          fontSize: "12px",
                          borderRadius: "6px",
                          border: "none",
                          background: active ? "#e50914" : "#27272a",
                          color: active ? "#fff" : "#a1a1aa",
                          cursor: "pointer",
                          fontWeight: active ? "600" : "normal",
                        }}
                      >
                        {g.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={closeModal}
                  style={{ padding: "10px 18px", background: "#27272a", color: "#e4e4e7", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "14px" }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  style={{ padding: "10px 22px", background: "#e50914", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "600", fontSize: "14px", cursor: "pointer" }}
                >
                  {createMutation.isPending || updateMutation.isPending ? "Đang lưu…" : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}