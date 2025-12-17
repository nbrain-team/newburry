"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('xsourcing_token');
    if (token) {
      router.push('/ai-agent');
    } else {
      router.push('/login');
    }
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-2">Newburry Platform</h1>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
