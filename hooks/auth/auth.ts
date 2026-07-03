import { useMutation } from "@tanstack/react-query";
import {
  forgetPassword,
  loginUser,
  registerUser,
  resetPassword,
  validateMail,
  resendVerificationMail,
} from "@/api/auth";

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

export const useResendVerificationMail = () => {
  return useMutation({
    mutationFn: resendVerificationMail,
  });
};

export const useForgetPassword = () => {
  return useMutation({
    mutationFn: forgetPassword,
  });
};

export const useResetPassword = () => {
  return useMutation({
    mutationFn: resetPassword,
  });
};
