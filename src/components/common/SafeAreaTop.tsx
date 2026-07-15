"use client";

import React from "react";
import { useSafeArea } from "@/hooks/common/useSafeArea";

export const SafeAreaTop: React.FC = () => {
  const { top } = useSafeArea();

  if (top <= 0) return null;

  return (
    <div
      style={{ height: `${top}px` }}
      className="w-full shrink-0 transition-all duration-300"
      aria-hidden="true"
    />
  );
};
