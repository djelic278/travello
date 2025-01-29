import { useFormLoading, useIsFormLoading } from "@/hooks/use-form-loading";
import { FormSkeleton } from "./form-skeleton";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface FormWrapperProps {
  children: React.ReactNode;
  formId: string;
  className?: string;
}

export function FormWrapper({ children, formId, className }: FormWrapperProps) {
  const isLoading = useIsFormLoading(formId);

  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div
          key="skeleton"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={cn("w-full", className)}
        >
          <FormSkeleton />
        </motion.div>
      ) : (
        <motion.div
          key="form"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={cn("w-full", className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}