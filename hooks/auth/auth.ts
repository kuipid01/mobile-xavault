import { useMutation } from "@tanstack/react-query";
import {
  forgetPassword,
  loginUser,
  registerUser,
  startRegistration,
  resetPassword,
  validateMail,
  verifyRegistrationMail,
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

export const useStartRegistration = () => {
  return useMutation({
    mutationFn: startRegistration,
  });
};

export const useVerifyRegistrationMail = () => {
  return useMutation({
    mutationFn: verifyRegistrationMail,
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
