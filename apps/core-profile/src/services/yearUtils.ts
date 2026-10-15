// Lấy năm bắt đầu từ nhãn mốc: "2020 - 2024" -> 2020, "2024 - Hiện Tại" -> 2024
export function parseStartYear(label: string, fallback = new Date().getFullYear()): number {
  const match = label.match(/\d{4}/);
  return match ? Number(match[0]) : fallback;
}
