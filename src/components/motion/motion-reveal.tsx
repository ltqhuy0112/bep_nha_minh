"use client";

import type { ReactNode } from "react";
import { LazyMotion, domAnimation, m } from "motion/react";

type MotionRevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

export function MotionReveal({
  children,
  className = "",
  delay = 0
}: MotionRevealProps) {
  return (
    <LazyMotion features={domAnimation}>
      <m.div
        className={className}
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5, delay, ease: "easeOut" }}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}
