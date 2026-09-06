import { ReportCategory } from "../types";

export const reportCategories: {
  key: ReportCategory;
  label: string;
  hint: string;
}[] = [
  {
    key: "NGETEM",
    label: "Ngetem",
    hint: "Angkot berhenti terlalu lama dan mengganggu arus lalu lintas.",
  },
  {
    key: "RECKLESS_DRIVING",
    label: "Berkendara Bahaya",
    hint: "Ngebut, zig-zag, melawan arah, atau membahayakan penumpang.",
  },
  {
    key: "SECURITY",
    label: "Keamanan",
    hint: "Pencurian, pelecehan seksual, pemerasan, atau situasi tidak aman.",
  },
  {
    key: "SERVICE",
    label: "Pelayanan Buruk",
    hint: "Tarif, sikap, atau layanan tidak sesuai.",
  },
  {
    key: "OTHER",
    label: "Lainnya",
    hint: "Laporan lain yang relevan untuk Dishub Bogor.",
  },
];
