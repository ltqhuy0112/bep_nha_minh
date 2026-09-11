"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/ui/section-heading";
import type { Locale } from "@bep-nha-minh/shared/constants/i18n";

const questions = {
  vi: [
    ["Khi nào bếp mở bán?", "Bếp sẽ gửi ngày mở bán chính thức qua waitlist khi lịch đã sẵn sàng."],
    ["Bếp giao ở đâu?", "Bếp dự kiến giao tại TP.HCM."],
    ["Khung giờ giao là khi nào?", "Các khung dự kiến là 10:30–12:00, 12:00–13:30, 17:00–18:30 và 18:30–20:00."],
    ["Làm sao nhận catalog?", "Để lại số điện thoại ở waitlist để nhận catalog mới nhất và thông báo mở bán."]
  ],
  en: [
    ["When will the kitchen open?", "The official opening date will be sent through the waitlist when the schedule is ready."],
    ["Where will the kitchen deliver?", "The kitchen plans to deliver in Ho Chi Minh City."],
    ["What are the delivery windows?", "Planned windows are 10:30–12:00, 12:00–13:30, 17:00–18:30, and 18:30–20:00."],
    ["How do I receive the catalog?", "Leave your phone number on the waitlist for the latest catalog and launch news."]
  ]
} as const;

export function FaqSection({ locale }: { locale: Locale }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const copy = locale === "vi" ? { eyebrow: "Thông tin", title: "Câu hỏi thường gặp" } : { eyebrow: "Details", title: "Frequently asked questions" };

  return (
    <section className="py-16 md:py-24">
      <Container className="grid gap-10 md:grid-cols-[0.8fr_1.2fr]">
        <SectionHeading eyebrow={copy.eyebrow} title={copy.title} />
        <div className="divide-y divide-olive-700/10 border-y border-olive-700/10">
          {questions[locale].map(([question, answer], index) => {
            const isOpen = openIndex === index;
            return <div key={question}>
              <button type="button" className="flex min-h-14 w-full items-center justify-between gap-4 py-4 text-left font-semibold text-olive-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive-700" aria-expanded={isOpen} onClick={() => setOpenIndex(isOpen ? null : index)}>
                {question}<ChevronDown aria-hidden="true" className={`size-5 shrink-0 transition ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen ? <p className="pb-5 text-base leading-7 text-muted">{answer}</p> : null}
            </div>;
          })}
        </div>
      </Container>
    </section>
  );
}
