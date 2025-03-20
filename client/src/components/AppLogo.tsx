import { Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-12 w-12"
};

export function AppLogo({ className, size = "md" }: AppLogoProps) {
  return (
    <div className={cn("relative inline-block", className)}>
      <Briefcase 
        className={cn(
          "text-primary transition-colors duration-200",
          sizeClasses[size]
        )} 
      />
    </div>
  );
}