export const chunkArray = (items, size) => {
  const chunkSize = Math.max(1, Number(size) || 1);
  const chunks = [];
  for (let i = 0; i < items.length; i += chunkSize) chunks.push(items.slice(i, i + chunkSize));
  return chunks;
};

export const groupRowsByVehicle = (rows) => {
  const grouped = new Map();
  for (const row of rows) {
    const key = String(row.vehicle_id);
    const list = grouped.get(key) || [];
    list.push(row);
    grouped.set(key, list);
  }
  return grouped;
};

export const runWithConcurrency = async (items, concurrency, handler) => {
  if (items.length === 0) return;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: workerCount }, async (_, workerIndex) => {
    for (let i = workerIndex; i < items.length; i += workerCount) {
      await handler(items[i]);
    }
  }));
};
