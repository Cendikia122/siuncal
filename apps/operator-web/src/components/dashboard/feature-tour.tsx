"use client"

import { useCallback, useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  ACTIONS,
  EVENTS,
  Joyride,
  STATUS,
  type EventData,
  type Step,
} from "react-joyride"

type DemoTourStep = Step & {
  path: string
  matchPath?: (pathname: string) => boolean
}

const steps: DemoTourStep[] = [
  {
    path: "/dashboard",
    target: "[data-tour='dashboard-realtime']",
    title: "Dashboard operasional",
    content: "Ini adalah pusat komando SI UNCAL. Dari satu layar, pengelola bisa melihat kondisi angkot di lapangan, titik yang bermasalah, dan area yang perlu perhatian.",
    placement: "bottom",
  },
  {
    path: "/dashboard",
    target: "[data-tour='marker-legend']",
    title: "Pergerakan armada",
    content: "Setiap titik di peta adalah kendaraan yang sedang dipantau. Warna membantu membaca situasi dengan cepat: mana yang berjalan normal, berhenti terlalu lama, bermasalah, atau tidak terhubung.",
    placement: "top",
  },
  {
    path: "/dashboard",
    target: "[data-tour='map-layers']",
    title: "Lapisan informasi",
    content: "Tombol ini menambahkan konteks ke peta, seperti area ramai, rute resmi, dan posisi warga. Tujuannya agar keputusan tidak hanya berdasarkan titik kendaraan, tapi juga kondisi sekitar.",
    placement: "left",
  },
  {
    path: "/dashboard",
    target: "[data-tour='kpi-cards']",
    title: "Ringkasan keadaan",
    content: "Panel ini merangkum hal yang paling penting: jumlah kendaraan aktif, laporan masalah, dan kondisi layanan. Tim bisa langsung tahu apa yang harus diprioritaskan.",
    placement: "left",
  },
  {
    path: "/dashboard/vehicles",
    target: "[data-tour='vehicles-header']",
    title: "Armada",
    content: "Di sini semua kendaraan tercatat rapi: plat nomor, trayek, pemilik, status, dan tingkat risiko. Ini membantu pemerintah atau pengelola melihat armada sebagai aset yang bisa diawasi.",
    placement: "bottom",
  },
  {
    path: "__vehicle-detail__",
    matchPath: (value) => value.startsWith("/dashboard/vehicles/"),
    target: "[data-tour='vehicle-playback']",
    title: "Riwayat perjalanan",
    content: "Jika ada keluhan atau pelanggaran, perjalanan kendaraan bisa diputar ulang. Tim dapat melihat kemana kendaraan bergerak, kapan terjadi masalah, dan bukti perjalanannya.",
    placement: "right",
  },
  {
    path: "/dashboard/owners",
    target: "[data-tour='owners-header']",
    title: "Pemilik",
    content: "SI UNCAL tidak hanya melihat kendaraan, tetapi juga siapa pemilik atau koperasinya. Ini penting untuk pembinaan, evaluasi layanan, dan akuntabilitas.",
    placement: "bottom",
  },
  {
    path: "/dashboard/intelligence",
    target: "[data-tour='intelligence-header']",
    title: "Fleet Intelligence",
    content: "Bagian ini mengubah data harian menjadi insight. SI UNCAL membantu menunjukkan pola: kendaraan mana yang sering bermasalah, area mana yang rawan, dan apa yang perlu ditindaklanjuti.",
    placement: "bottom",
  },
  {
    path: "/dashboard/network",
    target: "[data-tour='network-header']",
    title: "Jaringan",
    content: "Tampilan jaringan memperlihatkan hubungan antara pemilik, kendaraan, trayek, dan masalah yang muncul. Ini memudahkan melihat apakah masalah berdiri sendiri atau bagian dari pola yang lebih besar.",
    placement: "bottom",
  },
  {
    path: "/dashboard/sanctions",
    target: "[data-tour='sanctions-header']",
    title: "Sanksi",
    content: "Ketika pelanggaran perlu ditindak, keputusan bisa dicatat di sini. Prosesnya lebih transparan karena alasan, kendaraan, pemilik, dan masa berlaku sanksi tersimpan.",
    placement: "bottom",
  },
  {
    path: "/dashboard/compliance",
    target: "[data-tour='compliance-header']",
    title: "Kepatuhan",
    content: "Halaman ini memberi gambaran siapa yang paling patuh dan siapa yang perlu dibina. Cocok untuk laporan manajemen, evaluasi koperasi, dan dasar pengambilan kebijakan.",
    placement: "bottom",
  },
  {
    path: "/dashboard/heatmap",
    target: "[data-tour='heatmap-controls']",
    title: "Heatmap",
    content: "Heatmap menunjukkan area yang paling sering ramai, macet, berhenti lama, atau keluar jalur. Ini membantu menentukan lokasi pengawasan tanpa harus menebak-nebak.",
    placement: "bottom",
  },
]

export function DashboardFeatureTour() {
  const router = useRouter()
  const pathname = usePathname()
  const [run, setRun] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)

  const currentStep = steps[stepIndex]
  const isOnStepPath = currentStep?.matchPath ? currentStep.matchPath(pathname) : pathname === currentStep?.path

  const resolveStepPath = useCallback((step: DemoTourStep) => {
    if (step.path !== "__vehicle-detail__") return step.path
    const firstVehicleLink = document.querySelector<HTMLAnchorElement>('a[href^="/dashboard/vehicles/"]')
    return firstVehicleLink?.getAttribute("href") || "/dashboard/vehicles"
  }, [])

  const startTour = useCallback(() => {
    setStepIndex(0)
    if (pathname !== steps[0].path) {
      router.push(resolveStepPath(steps[0]))
    }
    setRun(true)
  }, [pathname, resolveStepPath, router])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isTourShortcut = event.key.toLowerCase() === "b" && event.shiftKey && (event.metaKey || event.ctrlKey)
      if (!isTourShortcut) return

      event.preventDefault()
      startTour()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [startTour])

  useEffect(() => {
    if (!run || !currentStep) return
    if (isOnStepPath) return

    const timeout = window.setTimeout(() => {
      router.push(resolveStepPath(currentStep))
    }, currentStep.path === "__vehicle-detail__" ? 450 : 0)

    return () => window.clearTimeout(timeout)
  }, [currentStep, isOnStepPath, pathname, resolveStepPath, router, run])

  const handleJoyrideEvent = useCallback((data: EventData) => {
    const { action, index, status, type } = data

    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      setStepIndex(Math.max(0, Math.min(steps.length - 1, index + (action === ACTIONS.PREV ? -1 : 1))))
    }

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false)
      setStepIndex(0)
    }
  }, [])

  return (
    <Joyride
      continuous
      run={run && isOnStepPath}
      scrollToFirstStep
      stepIndex={stepIndex}
      steps={steps}
      onEvent={handleJoyrideEvent}
      options={{
        arrowColor: "#09090b",
        backgroundColor: "#09090b",
        buttons: ["back", "close", "primary", "skip"],
        overlayColor: "rgba(0, 0, 0, 0.72)",
        primaryColor: "#10b981",
        showProgress: true,
        skipBeacon: true,
        spotlightPadding: 8,
        spotlightRadius: 8,
        textColor: "#f4f4f5",
        width: 380,
        zIndex: 1200,
      }}
      locale={{
        back: "Kembali",
        close: "Tutup",
        last: "Selesai",
        next: "Lanjut",
        skip: "Lewati",
      }}
      styles={{
        tooltip: {
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: 8,
          maxWidth: "calc(100vw - 32px)",
          padding: 18,
        },
        tooltipTitle: {
          color: "#ffffff",
          fontSize: 16,
          fontWeight: 700,
        },
        tooltipContent: {
          color: "#d4d4d8",
          fontSize: 13,
          lineHeight: 1.55,
        },
      }}
    />
  )
}
