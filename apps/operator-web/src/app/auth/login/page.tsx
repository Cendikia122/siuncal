"use client"

import { useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, Mail, Lock, ShieldCheck, Activity } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { AuthUser, useAuthStore } from "@/store/auth-store"

type LoginResponse = {
  user?: AuthUser
}

export default function LoginPage() {
  const router = useRouter()
  const setUser = useAuthStore((state) => state.setUser)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    setLoading(true)

    try {
      // Simulator delay for smooth UX if api is too fast
      // await new Promise(resolve => setTimeout(resolve, 800)) 

      const data = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      })

      const profile = data.user || (await apiFetch<AuthUser>("/me"))
      setUser(profile)

      const target = profile.roles?.includes("ANALISA") ? "/dashboard/reports" : "/dashboard"
      router.push(target)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login gagal, silakan coba lagi.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full lg:grid lg:grid-cols-2 relative bg-background overflow-hidden">
      {/* 
        LEFT SIDE: Branding & Visuals 
        Visible only on large screens
      */}
      <div className="hidden lg:flex flex-col relative bg-zinc-900 text-white p-12 justify-between">
        {/* Abstract Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <Image
            src="/angkot-traffic-problem.jpeg"
            alt="Latar Belakang Transportasi"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-zinc-900/75 mix-blend-multiply" />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/40 to-transparent" />
        </div>

        {/* Top Branding */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="h-1 w-6 bg-emerald-400 rounded-full" />
          <span className="text-sm font-semibold tracking-widest uppercase text-emerald-400">SI UNCAL</span>
        </div>

        {/* Middle Content */}
        <div className="relative z-10 max-w-md space-y-6">
          <h1 className="text-4xl font-bold tracking-tight leading-tight text-white">
            Inteligensi Operasional Angkutan Kota Bogor
          </h1>
          <p className="text-zinc-400 leading-relaxed">
            Pantau armada, tangani insiden, dan tinjau laporan warga — semuanya dari satu dashboard.
          </p>
        </div>

        {/* Bottom copyright/info */}
        <div className="relative z-10 text-sm text-zinc-500">
          <p>© 2025 Dinas Perhubungan Kota Bogor via SI UNCAL Platform.</p>
        </div>
      </div>


      {/* 
        RIGHT SIDE: Login Form 
        Center content, clean UX
      */}
      <div className="flex flex-col justify-center items-center p-6 lg:p-12 relative bg-background">
        <div className="w-full max-w-[400px] space-y-8">
          <div className="space-y-2 text-center">
            <h2 className="text-3xl font-bold tracking-tight">Selamat Datang</h2>
            <p className="text-muted-foreground">
              Masuk untuk mengakses dashboard operasional.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/90 pl-0.5" htmlFor="email">
                  Email
                </label>
                <div className="relative group">
                  <div className="absolute left-3 top-3 text-muted-foreground group-focus-within:text-emerald-500 transition-colors">
                    <Mail className="h-5 w-5" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    placeholder="nama@dishub.bogorkota.go.id"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="flex h-11 w-full rounded-xl border border-input bg-transparent px-3 py-1 pl-10 text-base shadow-sm transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 hover:border-emerald-500/50 group-focus-within:border-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground/90 pl-0.5" htmlFor="password">
                    Password
                  </label>
                  <span className="text-xs font-medium text-muted-foreground" title="Reset password belum tersedia mandiri. Hubungi administrator sistem.">
                    Reset via admin
                  </span>
                </div>
                <div className="relative group">
                  <div className="absolute left-3 top-3 text-muted-foreground group-focus-within:text-emerald-500 transition-colors">
                    <Lock className="h-5 w-5" />
                  </div>
                  <input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="flex h-11 w-full rounded-xl border border-input bg-transparent px-3 py-1 pl-10 text-base shadow-sm transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 hover:border-emerald-500/50 group-focus-within:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-3 p-3 text-sm text-red-500 bg-red-500/5 border border-red-500/10 rounded-xl animate-in fade-in slide-in-from-top-1">
                <ShieldCheck className="h-4 w-4 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <Button
              type="submit"
              variant="glow"
              size="lg"
              className="w-full rounded-xl font-semibold"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Memverifikasi...
                </>
              ) : (
                "Masuk Dashboard"
              )}
            </Button>
          </form>

          <div className="flex justify-center gap-6 opacity-50 hover:opacity-100 transition-opacity duration-300 pt-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> TLS 1.3 Encrypted
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Activity className="h-3.5 w-3.5" /> 99.9% Uptime
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
