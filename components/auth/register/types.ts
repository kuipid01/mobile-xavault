export type SupportedCountry = "NG" | "GH";
export type RegisterStep = "email" | "details" | "pin";

export type RegisterDraft = {
  step: RegisterStep;
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  country: SupportedCountry;
  phone: string;
  gender: string;
  dob: string;
  makeHalal: boolean;
};
