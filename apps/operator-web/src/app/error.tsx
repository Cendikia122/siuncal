"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-foreground p-6">
      <h1 className="text-2xl font-bold">Terjadi Kesalahan</h1>
      <p className="text-muted-foreground text-center max-w-md">
        Sistem mengalami kendala. Silakan coba ulangi atau hubungi admin bila masalah berlanjut.
      </p>
      <Button variant="glow" onClick={() => reset()}>
        Muat Ulang
      </Button>
    </div>
  )
}
