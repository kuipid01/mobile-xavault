export const getApiErrorMessage = (error: any) => {
  const data = error?.response?.data;

  if (data?.error && typeof data.error === "object") {
    const firstError = Object.values(data.error)[0];
    if (typeof firstError === "string") return firstError;
  }

  if (typeof data?.message === "string") return data.message;
  if (typeof error?.message === "string") return error.message;

  return "Please try again.";
};

export const normalizeUsername = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
