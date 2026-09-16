import {
  createEnvelope,
  deleteEnvelope,
  getEnvelope,
  getEnvelopes,
  updateEnvelope,
} from "@/api/envelopes";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { planKeys } from "./plans";

export const envelopeKeys = {
  list: (planId?: string) => ["plans", planId, "envelopes"] as const,
  detail: (planId?: string, envelopeId?: string) =>
    ["plans", planId, "envelopes", envelopeId] as const,
};

export const useEnvelopes = (planId?: string) => {
  return useQuery({
    queryKey: envelopeKeys.list(planId),
    queryFn: () => getEnvelopes(planId || ""),
    enabled: !!planId,
  });
};

export const useEnvelope = (planId?: string, envelopeId?: string) => {
  return useQuery({
    queryKey: envelopeKeys.detail(planId, envelopeId),
    queryFn: () => getEnvelope(planId || "", envelopeId || ""),
    enabled: !!planId && !!envelopeId,
  });
};

export const useCreateEnvelope = (planId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Parameters<typeof createEnvelope>[1]) => createEnvelope(planId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: envelopeKeys.list(planId) });
      queryClient.invalidateQueries({ queryKey: planKeys.detail(planId) });
      queryClient.invalidateQueries({ queryKey: planKeys.preview(planId) });
    },
  });
};

export const useUpdateEnvelope = (planId: string, envelopeId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Parameters<typeof updateEnvelope>[2]) =>
      updateEnvelope(planId, envelopeId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: envelopeKeys.list(planId) });
      queryClient.invalidateQueries({ queryKey: envelopeKeys.detail(planId, envelopeId) });
      queryClient.invalidateQueries({ queryKey: planKeys.preview(planId) });
    },
  });
};

export const useDeleteEnvelope = (planId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (envelopeId: string) => deleteEnvelope(planId, envelopeId),
    onSuccess: async (_data, envelopeId) => {
      const detailKey = envelopeKeys.detail(planId, envelopeId);

      await queryClient.cancelQueries({ queryKey: detailKey, exact: true });
      queryClient.invalidateQueries({
        queryKey: envelopeKeys.list(planId),
        exact: true,
      });
      queryClient.invalidateQueries({ queryKey: planKeys.list() });
      queryClient.invalidateQueries({ queryKey: planKeys.detail(planId) });
      queryClient.invalidateQueries({ queryKey: planKeys.preview(planId) });
    },
  });
};
