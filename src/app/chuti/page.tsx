"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ChutiPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return null;
}
