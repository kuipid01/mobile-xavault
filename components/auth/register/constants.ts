import type { RegisterDraft, SupportedCountry } from "./types";

export const countryMeta: Record<
  SupportedCountry,
  { label: string; maxLength: number; alternateLength: number; hint: string }
> = {
  NG: {
    label: "Nigeria",
    maxLength: 11,
    alternateLength: 10,
    hint: "Use 10 digits, or 11 digits starting with 0.",
  },
  GH: {
    label: "Ghana",
    maxLength: 10,
    alternateLength: 9,
    hint: "Use 9 digits, or 10 digits starting with 0.",
  },
};

export const initialDraft: RegisterDraft = {
  step: "email",
  email: "",
  firstName: "",
  lastName: "",
  username: "",
  country: "NG",
  phone: "",
  makeHalal: false,
};
