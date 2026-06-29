import { useMutation } from "@tanstack/react-query";
import { loginUser, registerUser, validateMail } from "@/api/auth";

export const useLogin = () => {
  return useMutation({
    mutationFn: loginUser,
  });
};

export const useRegister = () => {
  return useMutation({
    mutationFn: registerUser,
  });
};

export const useValidateMail = () => {
  return useMutation({
    mutationFn: validateMail,
  });
};
