import { api } from "./client";
import { ApiResponse } from "./types";

export type UserProfile = {
  id: string;
  email: string;
  nickname?: string | null;
  date_of_birth?: string | null;
  address?: string | null;
  profile_image_url?: string | null;
  country?: string;
  phone_number?: string;
  mail_verified?: boolean;
  has_withdrawal_pin?: boolean;
  created_at?: string;
  updated_at?: string;
  first_name?:string;
  last_name?:string;
}; 

export type UpdateProfilePayload = {
  nickname?: string;
  date_of_birth?: string;
  address?: string;
};

export type NicknameAvailability = {
  nickname: string;
  available: boolean;
};

export type SecurityQuestion = {
  id?: string;
  question: string;
  answer?: string;
  created_at?: string;
  updated_at?: string;
};

export const getProfile = async () => {
  const res = await api.get<ApiResponse<UserProfile>>("/auth/profile");
  return res.data.data;
};

export const updateProfile = async (payload: UpdateProfilePayload) => {
  const res = await api.put<ApiResponse<UserProfile>>("/auth/profile", payload);
  return res.data.data;
};

export const checkNickname = async (nickname: string) => {
  const res = await api.get<ApiResponse<NicknameAvailability>>(
    "/auth/profile/nickname/check",
    { params: { nickname } }
  );
  return res.data.data;
};

export const uploadProfileImage = async (asset: {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}) => {
  const form = new FormData();
  form.append("image", {
    uri: asset.uri,
    name: asset.fileName || "profile.jpg",
    type: asset.mimeType || "image/jpeg",
  } as unknown as Blob);

  const res = await api.post<ApiResponse<UserProfile>>("/auth/profile/image", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data.data;
};

export const getSecurityQuestions = async () => {
  const res = await api.get<ApiResponse<{ items: SecurityQuestion[] }>>(
    "/auth/security-questions"
  );
  return res.data.data?.items || [];
};

export const saveSecurityQuestions = async (questions: SecurityQuestion[]) => {
  const res = await api.put<ApiResponse<{ items: SecurityQuestion[] }>>(
    "/auth/security-questions",
    { questions }
  );
  return res.data.data?.items || [];
};
