
import { useMutation, useQuery, useQueryClient, UseQueryOptions, } from "@tanstack/react-query";
import { createSubscription, dismissSubscriptionPayment, getActiveSubscription, getSubscriptionPlans, UserSubscription } from "../../api/subscription";


export const subscriptionKeys = {
  plans: ["subscriptions", "plans"] as const,
  active: ["subscriptions", "active"] as const,
};

export function useActiveSubscription(
  options?: Partial<UseQueryOptions<UserSubscription>>
) {
  return useQuery({
    queryKey: subscriptionKeys.active,
    queryFn: getActiveSubscription,
    enabled: false,
    ...options,
  });
}export const useCreateSubscription = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSubscription,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: subscriptionKeys.active,
      });
    },
  });
};

export const useDismissSubscriptionPayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: dismissSubscriptionPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: subscriptionKeys.active,
      });
    },
  });
};

export const useSubscriptionPlans = () => {
  return useQuery({
    queryKey: subscriptionKeys.plans,
    queryFn: getSubscriptionPlans,
  });
};

