import Link from "next/link"
import { MapPin } from "lucide-react"

export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-background py-12 text-sm text-muted-foreground">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2 font-bold text-foreground">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-emerald-500/20 text-emerald-500">
                <MapPin className="h-4 w-4" />
              </div>
              Monitoring Angkot
            </Link>
            <p className="text-xs leading-relaxed max-w-xs">
              Sistem monitoring dan manajemen angkutan kota Bogor berbasis teknologi geospasial real-time untuk transportasi yang lebih aman dan teratur.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-4">Platform</h3>
            <ul className="space-y-2">
              <li><Link href="/dashboard" className="hover:text-primary transition-colors">Dashboard Operator</Link></li>
              <li><span className="text-muted-foreground/70">Mobile App</span></li>
              <li><Link href="/dashboard/devices" className="hover:text-primary transition-colors">GPS Tracker</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-4">Sumber Daya</h3>
            <ul className="space-y-2">
              <li><span className="text-muted-foreground/70">Dokumentasi API</span></li>
              <li><span className="text-muted-foreground/70">Panduan Sistem</span></li>
              <li><Link href="/dashboard/observability" className="hover:text-primary transition-colors">Status Layanan</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-4">Legal</h3>
            <ul className="space-y-2">
              <li><span className="text-muted-foreground/70">Privasi & Kebijakan</span></li>
              <li><span className="text-muted-foreground/70">Syarat Ketentuan</span></li>
              <li><Link href="/dashboard/compliance" className="hover:text-primary transition-colors">Kepatuhan Trayek</Link></li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-8 border-t border-white/5">
          <p>© 2025 Pemerintah Kota Bogor & Tim Pengembang. All rights reserved.</p>
          <div className="flex gap-4">
            {/* Social icons could go here */}
          </div>
        </div>
      </div>
    </footer>
  )
}
