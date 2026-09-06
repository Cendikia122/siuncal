"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 bg-background text-foreground p-6">
      <h2 className="text-xl font-semibold">Gagal Memuat Dashboard</h2>
      <p className="text-muted-foreground text-center max-w-md">
        Ada gangguan saat memuat data dashboard. Coba refresh halaman.
      </p>
      <Button variant="outline" onClick={() => reset()}>
        Coba Lagi
      </Button>
    </div>
  )
}
