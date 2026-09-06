export const formatLastSeen = (value?: string | null) => {
  if (!value) {
    return "Belum ada sinyal";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Waktu tidak valid";
  }

  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));

  if (minutes < 1) {
    return "Baru saja";
  }

  if (minutes < 60) {
    return `${minutes} menit lalu`;
  }

  const hours = Math.round(minutes / 60);
  return `${hours} jam lalu`;
};

export const normalizePlate = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
