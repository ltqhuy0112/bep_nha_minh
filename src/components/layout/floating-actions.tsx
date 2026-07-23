"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const hotline = "0915442787";
const hotlineDisplay = "091 544 2787";

type FloatingActionsProps = {
  locale: "vi" | "en";
};

export function FloatingActions({ locale }: FloatingActionsProps) {
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setShowScrollTop(window.scrollY > 420);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const labels =
    locale === "en"
      ? {
          call: "Call Bếp Nhà Mình hotline",
          scrollTop: "Back to top",
          hotline: "Call hotline"
        }
      : {
          call: "Gọi hotline Bếp Nhà Mình",
          scrollTop: "Lên đầu trang",
          hotline: "Gọi hotline"
        };

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 md:bottom-7 md:right-7">
      <button
        type="button"
        aria-label={labels.scrollTop}
        title={labels.scrollTop}
        onClick={scrollToTop}
        className={[
          "group grid size-14 place-items-center rounded-full border border-olive-700/15 bg-cream-100 text-olive-900 shadow-soft transition duration-300 hover:-translate-y-1 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-olive-700",
          showScrollTop
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-3 opacity-0"
        ].join(" ")}
      >
        <span className="grid size-10 place-items-center rounded-full bg-olive-700/10 transition group-hover:bg-olive-700 group-hover:text-cream-100">
          <ArrowUpIcon />
        </span>
      </button>

      <a
        href={`tel:${hotline}`}
        aria-label={labels.call}
        title={`${labels.hotline}: ${hotlineDisplay}`}
        className="group inline-flex min-h-14 items-center gap-3 rounded-full border border-cream-100/80 bg-emerald-700 px-4 text-cream-100 shadow-soft transition hover:-translate-y-1 hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700 sm:bg-olive-900 sm:hover:bg-olive-700"
      >
        <span className="grid size-10 place-items-center rounded-full bg-cream-100 text-emerald-800 transition group-hover:scale-105 sm:hidden">
          <PhoneIcon />
        </span>
        <span className="relative hidden size-10 overflow-hidden rounded-full border border-cream-100/60 bg-olive-700 transition group-hover:scale-105 sm:block">
          <Image
            src="/brand-logo.jpg"
            alt=""
            fill
            sizes="40px"
            className="object-cover"
          />
        </span>
        <span className="hidden pr-1 text-left sm:block">
          <span className="block text-xs font-bold uppercase tracking-[0.16em] text-cream-100/70">
            Hotline
          </span>
          <span className="block text-sm font-bold tracking-[0.04em]">
            {hotlineDisplay}
          </span>
        </span>
      </a>
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.91.33 1.8.62 2.65a2 2 0 0 1-.45 2.11L8 9.76a16 16 0 0 0 6.24 6.24l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.74.5 2.65.62A2 2 0 0 1 22 16.92Z" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-6 transition group-hover:-translate-y-0.5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
    >
      <path d="M12 19V5" />
      <path d="m6.5 10.5 5.5-5.5 5.5 5.5" />
      <path d="M6 21h12" opacity="0.42" />
    </svg>
  );
}
