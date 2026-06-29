import { api } from "./client";
import { ApiResponse, Envelope, UnboxedBalancePolicy } from "./types";

export type CreateEnvelopePayload = {
  name: string;
  amount: number;
  start_date: string;
  end_date: string;
  parent_envelope_id?: string | null;
  unboxed_balance_policy: Extract<UnboxedBalancePolicy, "flexible" | "locked_until_parent_ends">;
};

export type UpdateEnvelopePayload = Partial<CreateEnvelopePayload>;

export const getEnvelopes = async (planId: string) => {
  const res = await api.get<ApiResponse<Envelope[]>>(`/plans/${planId}/envelopes`);
  return res.data.data || [];
};

export const getEnvelope = async (planId: string, envelopeId: string) => {
  const res = await api.get<ApiResponse<Envelope>>(`/plans/${planId}/envelopes/${envelopeId}`);
  return res.data.data;
};

export const createEnvelope = async (planId: string, payload: CreateEnvelopePayload) => {
  const res = await api.post<ApiResponse<Envelope>>(`/plans/${planId}/envelopes`, payload);
  return res.data.data;
};

export const updateEnvelope = async (
  planId: string,
  envelopeId: string,
  payload: UpdateEnvelopePayload
) => {
  const res = await api.patch<ApiResponse<Envelope>>(
    `/plans/${planId}/envelopes/${envelopeId}`,
    payload
  );
  return res.data.data;
};

export const deleteEnvelope = async (planId: string, envelopeId: string) => {
  const res = await api.delete<ApiResponse<unknown>>(`/plans/${planId}/envelopes/${envelopeId}`);
  return res.data.data;
};
