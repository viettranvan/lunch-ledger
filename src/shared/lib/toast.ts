import { toast as sonnerToast } from "sonner";

export const toast = {
  success(message: string) {
    sonnerToast.success(message, { duration: 2000, dismissible: true });
  },

  error(message: string) {
    sonnerToast.error(message, { duration: 2500, dismissible: true });
  },

  info(message: string) {
    sonnerToast.info(message, { duration: 2000, dismissible: true });
  },

  warning(message: string) {
    sonnerToast.warning(message, { duration: 2000, dismissible: true });
  },
};
