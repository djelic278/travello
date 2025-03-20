import { Globe, Network, Briefcase } from "lucide-react";
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
      {/* Base Globe */}
      <Globe 
        className={cn(
          "text-primary absolute",
          sizeClasses[size]
        )} 
      />

      {/* Network overlay */}
      <Network 
        className={cn(
          "text-primary/60 absolute",
          sizeClasses[size]
        )} 
      />

      {/* Briefcase in center */}
      <Briefcase 
        className={cn(
          "text-primary/80 absolute scale-75",
          sizeClasses[size]
        )} 
      />
    </div>
  );
}