import { create } from 'zustand';

interface FormLoadingState {
  isLoading: boolean;
  formId: string | null;
  startLoading: (formId: string) => void;
  stopLoading: () => void;
}

export const useFormLoading = create<FormLoadingState>((set) => ({
  isLoading: false,
  formId: null,
  startLoading: (formId: string) => set({ isLoading: true, formId }),
  stopLoading: () => set({ isLoading: false, formId: null }),
}));

export function useIsFormLoading(formId: string) {
  return useFormLoading(
    (state) => state.isLoading && state.formId === formId
  );
}
