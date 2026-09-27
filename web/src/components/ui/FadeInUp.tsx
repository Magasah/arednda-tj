"use client";

import { motion, useReducedMotion } from "framer-motion";

const STAGGER_STEP = 0.08;

interface FadeInUpProps {
  children: React.ReactNode;
  index?: number;
  className?: string;
}

export function FadeInUp({ children, index = 0, className }: FadeInUpProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      data-fade=""
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.2, ease: "easeOut", delay: index * STAGGER_STEP }}
    >
      {children}
    </motion.div>
  );
}
