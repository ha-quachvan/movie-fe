"use client";

import Image from "next/image";

import { useState } from "react";
import { PROMOTIONS, Promotion } from "@/lib/mockData";

export default function PromotionSection() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  return (
    <section id="promotions" className="mx-auto max-w-6xl px-4 sm:px-6 py-14 sm:py-18">
      {/* Section Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between border-b border-white/10 pb-5">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-red-500">
            Đặc quyền thành viên
          </span>
          <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold text-white">
            Ưu Đãi & Khuyến Mãi Hot
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-neutral-400">
          Tiết kiệm hơn khi đặt vé online và thanh toán qua Stripe
        </p>
      </div>

      {/* Promotions Grid */}
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {PROMOTIONS.map((promo: Promotion) => (
          <article
            key={promo.id}
            className="group flex flex-col overflow-hidden rounded-2xl border border-white/5 bg-neutral-900/50 transition-all duration-300 hover:-translate-y-1.5 hover:border-white/20 hover:shadow-xl"
          >
            {/* Promo Image */}
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-neutral-800">
              <Image unoptimized width={800} height={500}
                src={promo.image}
                alt={promo.title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <span
                className="absolute top-3 left-3 rounded-md px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-white shadow-md backdrop-blur-md"
                style={{ backgroundColor: promo.accentColor }}
              >
                {promo.badge}
              </span>
            </div>

            {/* Promo Content */}
            <div className="flex flex-1 flex-col justify-between p-4 sm:p-5">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-red-400 transition-colors line-clamp-2">
                  {promo.title}
                </h3>
                <p className="mt-2 text-xs text-neutral-400 line-clamp-3 leading-relaxed">
                  {promo.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                {promo.code ? (
                  <button
                    type="button"
                    onClick={() => handleCopy(promo.code!)}
                    className="flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-400 transition-all hover:bg-red-500/20"
                  >
                    <span>Mã: {promo.code}</span>
                    <span className="text-[10px] text-neutral-300">
                      {copiedCode === promo.code ? "✓ Đã chép" : "📋"}
                    </span>
                  </button>
                ) : (
                  <span className="text-[11px] text-neutral-400 font-medium">
                    Hạn: {promo.validUntil}
                  </span>
                )}
                {promo.code && (
                  <span className="text-[10px] text-neutral-400">
                    Hạn: {promo.validUntil}
                  </span>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
