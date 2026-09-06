import { Sidebar } from "@/components/layout/sidebar"
import { Topbar } from "@/components/layout/topbar"
import { AuthGuard } from "@/components/auth/auth-guard"
import { DashboardFeatureTour } from "@/components/dashboard/feature-tour"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />
      <Topbar />
      <AuthGuard />
      <DashboardFeatureTour />
      <main className="pl-0 md:pl-64 pt-16 min-h-screen overflow-hidden">
        {children}
      </main>
    </div>
  )
}
