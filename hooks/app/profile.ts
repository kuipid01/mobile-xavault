import {
  checkNickname,
  getProfile,
  getSecurityQuestions,
  saveSecurityQuestions,
  SecurityQuestion,
  updateProfile,
  UpdateProfilePayload,
  uploadProfileImage,
} from "@/api/profile";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const profileKeys = {
  profile: ["profile"] as const,
  securityQuestions: ["profile", "security-questions"] as const,
};

export const useProfile = () => {
  return useQuery({
    queryKey: profileKeys.profile,
    queryFn: getProfile,
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateProfilePayload) => updateProfile(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.profile });
    },
  });
};

export const useCheckNickname = () => {
  return useMutation({
    mutationFn: (nickname: string) => checkNickname(nickname),
  });
};

export const useUploadProfileImage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadProfileImage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.profile });
    },
  });
};

export const useSecurityQuestions = () => {
  return useQuery({
    queryKey: profileKeys.securityQuestions,
    queryFn: getSecurityQuestions,
  });
};

export const useSaveSecurityQuestions = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (questions: SecurityQuestion[]) => saveSecurityQuestions(questions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.securityQuestions });
    },
  });
};
