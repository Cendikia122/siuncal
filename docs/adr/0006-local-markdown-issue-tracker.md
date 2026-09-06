# 0006. Issue tracker berbasis local markdown

- Status: Accepted
- Tanggal: 2026-07-22
- Konteks terkait: cross-cutting (proses pengembangan)

## Konteks
Repo terhubung ke GitHub (`ztrenggono/Sentra`), tetapi tim ingin issue dan PRD tersimpan bersama kode dan dapat dibaca/ditulis oleh skill engineering tanpa dependency GitHub Issues.

## Keputusan
Issue dan PRD disimpan sebagai file markdown di `.scratch/<feature-slug>/`:
- PRD: `.scratch/<feature-slug>/PRD.md`.
- Issue: `.scratch/<feature-slug>/issues/<NN>-<slug>.md`.
- Status triase = baris `Status:` di tiap issue (lihat `docs/agents/triage-labels.md`).
- Wajib ada baris `Scope:` (`fullstack`/`backend`/`frontend`/`parallel`).

Konfigurasi ini dicatat di `docs/agents/issue-tracker.md` dan blok `## Agent skills` di `AGENTS.md`.

## Konsekuensi
- Positif: issue ter-version bersama kode, tanpa dependency eksternal, cocok untuk kerja solo/AFK agent.
- Negatif: tidak ada UI issue/otomasi label seperti GitHub; sinkronisasi lintas kontributor bergantung Git.

## Alternatif dipertimbangkan
- GitHub Issues (`gh` CLI): opsi default skill, ditunda; bisa diadopsi nanti dengan re-run skill setup.
