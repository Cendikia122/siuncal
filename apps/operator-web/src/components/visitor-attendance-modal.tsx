"use client";

import { useEffect, useState } from "react";

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwFKwBB4Txk8czWJKpE0wQ8CxtYXWT_LqaawhNn2qB-_DoT9tpOstFIls740a9Grj58/exec";
const EXPIRED_DATE = new Date("2026-09-10T23:59:00+07:00");
const LS_KEY = "siuncal_absensi_done";

const ratingLabels = ["", "Kurang 😕", "Cukup 🙂", "Bagus 👍", "Keren 🤩", "Luar Biasa! 🔥"];

export function VisitorAttendanceModal() {
  const [show, setShow] = useState(false);
  const [nama, setNama] = useState("");
  const [selectedRating, setSelectedRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [counter, setCounter] = useState<number | null>(null);

  useEffect(() => {
    if (new Date() > EXPIRED_DATE) return;
    if (localStorage.getItem(LS_KEY)) return;

    const timer = setTimeout(() => {
      setShow(true);
      fetch(APPS_SCRIPT_URL + "?action=count")
        .then((res) => res.json())
        .then((data) => {
          if (data && typeof data.count === "number" && data.count > 0) {
            setCounter(data.count);
          }
        })
        .catch(() => {});
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  const handleClose = () => {
    setShow(false);
  };

  const handleSubmit = async () => {
    if (!selectedRating || submitting) return;
    setSubmitting(true);

    const payload = {
      nama: nama.trim() || "-",
      rating: selectedRating,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent.substring(0, 120) : "-",
      timestamp: new Date().toISOString(),
    };

    const markSuccess = () => {
      localStorage.setItem(LS_KEY, "1");
      setSubmitted(true);
      setTimeout(() => {
        setShow(false);
      }, 3000);
    };

    try {
      await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(payload),
      });
      markSuccess();
    } catch {
      markSuccess();
    }
  };

  const currentDisplayRating = hoverRating || selectedRating;

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="relative w-full max-w-[380px] bg-card text-card-foreground rounded-2xl p-7 pt-7 shadow-2xl border border-border animate-in zoom-in-95 duration-200">
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors text-lg leading-none"
          aria-label="Lewati"
          title="Lewati"
        >
          ✕
        </button>

        {!submitted ? (
          <div>
            <div className="inline-block bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full mb-3">
              🎪 Stand SI UNCAL
            </div>
            <h2 className="text-xl font-extrabold text-foreground mb-1.5 leading-tight">
              Halo! Selamat datang 👋
            </h2>
            <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
              Terima kasih sudah mengunjungi stand kami. Yuk, tinggalkan jejak kunjunganmu!
            </p>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Nama / Instansi <span className="text-muted-foreground font-normal">(opsional)</span>
              </label>
              <input
                type="text"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="cth. Budi dari Dishub Bogor"
                maxLength={80}
                className="w-full px-3 py-2.5 text-sm bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div className="mb-5">
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Rating kunjungan kamu ⭐
              </label>
              <div className="flex gap-2 mb-1.5">
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = star <= currentDisplayRating;
                  return (
                    <span
                      key={star}
                      onClick={() => setSelectedRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className={`text-3xl cursor-pointer transition-transform duration-150 select-none ${
                        active ? "opacity-100 filter-none scale-110" : "opacity-35 grayscale"
                      }`}
                    >
                      ⭐
                    </span>
                  );
                })}
              </div>
              <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 h-4">
                {currentDisplayRating ? ratingLabels[currentDisplayRating] : "— Pilih rating di atas —"}
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!selectedRating || submitting}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-all shadow-md active:scale-[0.98]"
            >
              {submitting ? "Mengirim..." : "Saya Sudah Mengunjungi ✓"}
            </button>

            {counter !== null && (
              <div className="text-center mt-4 text-xs text-muted-foreground">
                Sudah <strong className="text-emerald-600 dark:text-emerald-400">{counter}</strong> orang yang mengunjungi stand kami
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <div className="text-5xl mb-3">🎉</div>
            <h3 className="text-lg font-bold text-foreground mb-2">Terima kasih!</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Kunjunganmu sudah tercatat.<br />
              Semoga SI UNCAL bermanfaat untuk Kota Bogor!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
