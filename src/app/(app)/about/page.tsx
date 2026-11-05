import type { Metadata } from "next";
import Link from "next/link";
import Reveal from "@/components/Reveal";
import { FlameIcon, TargetIcon, MedalIcon, ZapIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Về chúng tôi · CineFlow",
  description:
    "CineFlow xây dựng hệ thống quản lý rạp phim, đặt vé và doanh thu hiện đại cho mọi quy trình vận hành.",
};

const STATS = [
  { num: "5", label: "thành viên" },
  { num: "12+", label: "rạp & phòng chiếu" },
  { num: "3.2K", label: "vé bán trong tháng" },
  { num: "98.6%", label: "tỷ lệ lấp đầy" },
];

const VALUES = [
  {
    Icon: TargetIcon,
    title: "Tối ưu vận hành",
    text: "Mỗi tính năng đều phục vụ mục tiêu quản lý lịch chiếu, ghế và doanh thu hiệu quả.",
  },
  {
    Icon: FlameIcon,
    title: "Đổi mới bền bỉ",
    text: "Tiến bộ đến từ quá trình lặp lại, cải thiện quy trình và nâng cấp trải nghiệm khách hàng.",
  },
  {
    Icon: MedalIcon,
    title: "Đồng bộ dữ liệu",
    text: "Phim, rạp, suất chiếu, vé và thanh toán được quản lý trong một hệ thống thống nhất.",
  },
  {
    Icon: ZapIcon,
    title: "Nhanh và chính xác",
    text: "Không ồn ào, không chậm trễ — chỉ tập trung vào tốc độ xử lý và độ tin cậy.",
  },
];

export default function AboutPage() {
  return (
    <div className="bg-[#120b0b] text-[#fff7f7]" style={{ fontFamily: "var(--font-be-vietnam), system-ui, sans-serif" }}>
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -right-32 -top-40 h-96 w-96 rounded-full opacity-60 blur-3xl" style={{ background: "radial-gradient(circle, rgba(239,68,68,.35), transparent 70%)" }} />
        <div aria-hidden className="pointer-events-none absolute -bottom-48 -left-24 h-96 w-96 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle, rgba(251,113,133,.45), transparent 70%)" }} />
        <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-16 sm:px-8 sm:pt-24">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#fca5a5] backdrop-blur">
              <FlameIcon size={14} className="text-[#ef4444]" />
              Về chúng tôi
            </span>
            <h1 className="mt-6 max-w-3xl text-4xl font-light leading-[1.08] tracking-tight sm:text-[56px]">
              Chúng tôi xây dựng
              <br />
              <strong className="font-semibold text-[#f87171]">hệ thống đặt vé & quản lý rạp phim</strong>
            </h1>
            <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-[#fee2e2]/75">
              CineFlow được tạo ra để phục vụ cả khách hàng và đội ngũ rạp: từ đặt vé online, chọn ghế, thanh toán, đến quản lý phim, phòng chiếu, lịch trình và doanh thu trong một nền tảng thống nhất.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className="rounded-full bg-gradient-to-r from-[#ef4444] to-[#f87171] px-6 py-3 text-sm font-semibold text-[#fff7f7] transition-transform hover:-translate-y-0.5">
                Đăng nhập hệ thống
              </Link>
              <Link href="/#operations" className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10">
                Khám phá tính năng →
              </Link>
            </div>
          </Reveal>

          <Reveal delay={140}>
            <div className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {STATS.map((s) => (
                <div key={s.label} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-7 text-center shadow-[0_18px_50px_-30px_rgba(239,68,68,0.25)] backdrop-blur">
                  <div className="text-3xl font-bold tracking-tight text-white">{s.num}</div>
                  <div className="mt-1.5 text-xs font-medium text-[#fee2e2]/70">{s.label}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <section className="border-t border-white/10 py-20">
          <div className="grid gap-10 md:grid-cols-[0.8fr_1.2fr]">
            <Reveal>
              <h2 className="text-3xl font-light leading-snug tracking-tight text-white">
                Sứ mệnh của <strong className="font-semibold text-[#f87171]">chúng tôi</strong>
              </h2>
            </Reveal>
            <Reveal delay={100}>
              <div className="space-y-4 text-[16px] leading-relaxed text-[#fee2e2]/75">
                <p>
                  Chúng tôi tin rằng một rạp phim tốt không chỉ có phim hay mà còn cần hệ thống vận hành rõ ràng, tức thì và đáng tin cậy.
                </p>
                <p>
                  CineFlow tập trung vào việc kết nối mọi bước từ quản trị phim, room, ghế, suất chiếu, giữ ghế, thanh toán Stripe cho đến doanh thu và báo cáo. Mục tiêu là giúp đội ngũ rạp tối ưu tốc độ, giảm lỗi và nâng trải nghiệm khách hàng.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="border-t border-white/10 py-20">
          <Reveal>
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#fca5a5]">Giá trị cốt lõi</div>
            <h2 className="mt-3 text-3xl font-light tracking-tight sm:text-4xl text-white">
              Nền tảng mạnh để <strong className="font-semibold text-[#f87171]">vận hành trọn vẹn</strong>
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {VALUES.map((value, index) => {
              const Icon = value.Icon;
              return (
                <Reveal key={value.title} delay={index * 80} className="h-full">
                  <div className="h-full rounded-3xl border border-white/10 bg-white/5 p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-[#ef4444]/10 text-[#fca5a5]">
                      <Icon size={22} />
                    </div>
                    <h3 className="mt-5 text-xl font-semibold text-white">{value.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-[#fee2e2]/72">{value.text}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
