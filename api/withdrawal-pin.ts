import { api } from "./client";
import { ApiResponse } from "./types";

export type WithdrawalPinStatus = {
  has_pin: boolean;
};

export const getWithdrawalPinStatus = async () => {
  const res = await api.get<ApiResponse<WithdrawalPinStatus>>(
    "/auth/withdrawal-pin/status"
  );
  return res.data.data;
};

export const setWithdrawalPin = async (pin: string) => {
  const res = await api.post<ApiResponse<WithdrawalPinStatus>>(
    "/auth/withdrawal-pin",
    { pin }
  );
  return res.data.data;
};

export const verifyWithdrawalPin = async (pin: string) => {
  const res = await api.post<ApiResponse<unknown>>(
    "/auth/withdrawal-pin/verify",
    { pin }
  );
  return res.data.data;
};

export const forgotWithdrawalPin = async () => {
  const res = await api.post<ApiResponse<unknown>>(
    "/auth/withdrawal-pin/forgot"
  );
  return res.data.data;
};

export const resetWithdrawalPin = async (payload: { otp: string; pin: string }) => {
  const res = await api.post<ApiResponse<WithdrawalPinStatus>>(
    "/auth/withdrawal-pin/reset",
    payload
  );
  return res.data.data;
};
