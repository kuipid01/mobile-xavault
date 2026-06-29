export const nairaToKobo = (value: string | number) => {
  const amount = typeof value === "number" ? value : Number(value.replace(/,/g, ""));
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
};

export const koboToNaira = (value?: number | null) => {
  if (!value) return 0;
  return value / 100;
};

export const formatMoney = (value?: number | null, currency = "NGN") => {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(koboToNaira(value));
};

export const formatDate = (date?: string | null) => {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-NG", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};
