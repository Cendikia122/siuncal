"use client"

import { Button } from "@/components/ui/button"
import { ArrowLeft, Building2, User, Save } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { apiFetch } from "@/lib/api"

export default function NewOwnerPage() {
  const [type, setType] = useState<"PERSONAL" | "COOP" | "COMPANY">("PERSONAL")
  const [identity, setIdentity] = useState({
    nik: "",
    name: "",
    phone: "",
    email: "",
    address: ""
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const handleSave = async () => {
    setError("")
    setSuccess("")
    setLoading(true)
    try {
      await apiFetch("/owners", {
        method: "POST",
        body: JSON.stringify({
          owner_type: type,
          name: identity.name,
          phone_primary: identity.phone,
          email: identity.email || null,
          base: {
            name: identity.address || null,
            lat: null,
            lon: null
          }
        })
      })
      setSuccess("Registrasi pemilik berhasil disimpan.")
      setIdentity({ nik: "", name: "", phone: "", email: "", address: "" })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan data pemilik")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/owners">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Registrasi Pemilik Baru</h1>
          <p className="text-muted-foreground">Daftarkan pemilik perseorangan, koperasi, atau badan usaha.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Form Section */}
        <form className="md:col-span-2 space-y-8 bg-card border border-border rounded-xl p-6" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>

          {/* Owner Type Selection */}
          <div className="space-y-4">
            <label className="text-sm font-medium">Tipe Pemilik</label>
            <div className="grid grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => setType("PERSONAL")}
                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-lg border transition-all ${type === 'PERSONAL' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500' : 'bg-secondary/50 border-transparent hover:bg-secondary'}`}
              >
                <User className="w-6 h-6" />
                <span className="text-xs font-semibold">Perseorangan</span>
              </button>
              <button
                type="button"
                onClick={() => setType("COOP")}
                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-lg border transition-all ${type === 'COOP' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500' : 'bg-secondary/50 border-transparent hover:bg-secondary'}`}
              >
                <User className="w-6 h-6" />
                <span className="text-xs font-semibold">Koperasi</span>
              </button>
              <button
                type="button"
                onClick={() => setType("COMPANY")}
                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-lg border transition-all ${type === 'COMPANY' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500' : 'bg-secondary/50 border-transparent hover:bg-secondary'}`}
              >
                <Building2 className="w-6 h-6" />
                <span className="text-xs font-semibold">PT / CV</span>
              </button>
            </div>
          </div>

          {/* Identity Form */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold border-b border-border pb-2">Identitas Utama</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">NIK / NPWP</label>
                <input
                  className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:border-emerald-500 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                  placeholder="3201xxxxxxxxxxxx"
                  value={identity.nik}
                  onChange={(event) => setIdentity({ ...identity, nik: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">Nama Lengkap</label>
                <input
                  className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:border-emerald-500 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                  placeholder={type === 'PERSONAL' ? "Nama sesuai KTP" : "Nama Perusahaan"}
                  value={identity.name}
                  onChange={(event) => setIdentity({ ...identity, name: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">No. Telepon / HP</label>
                <input
                  className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:border-emerald-500 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                  placeholder="08xxxxxxxxxx"
                  value={identity.phone}
                  onChange={(event) => setIdentity({ ...identity, phone: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">Email (Opsional)</label>
                <input
                  className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:border-emerald-500 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                  placeholder="email@example.com"
                  value={identity.email}
                  onChange={(event) => setIdentity({ ...identity, email: event.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase text-muted-foreground">Alamat Lengkap</label>
              <textarea
                className="w-full p-3 rounded-md border border-input bg-background/50 focus:border-emerald-500 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 min-h-[80px]"
                placeholder="Jalan Raya Bogor No..."
                value={identity.address}
                onChange={(event) => setIdentity({ ...identity, address: event.target.value })}
              />
            </div>
          </div>

        </form>

        {/* Sidebar Summary */}
        <div className="space-y-6">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6">
            <h2 className="font-semibold text-emerald-500 mb-2">Ringkasan Registrasi</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Pastikan data valid dan sesuai dengan dokumen resmi dari Dinas Perhubungan.
            </p>
            <ul className="space-y-3 text-sm">
              <li className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="font-mono bg-yellow-500/20 text-yellow-500 px-1.5 rounded text-xs">PENDING VERIFICATION</span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">Registrar</span>
                <span>Petugas A</span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">Tanggal</span>
                <span>{new Date().toLocaleDateString()}</span>
              </li>
            </ul>
          </div>

          <Button
            type="button"
            size="lg"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            onClick={handleSave}
            disabled={loading}
          >
            <Save className="w-4 h-4" /> {loading ? "Menyimpan..." : "Simpan Data Pemilik"}
          </Button>
          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-3">
              {error}
            </div>
          )}
          {success && (
            <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md p-3">
              {success}
            </div>
          )}
          <Button variant="outline" className="w-full" asChild>
            <Link href="/dashboard/owners">Batal</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
