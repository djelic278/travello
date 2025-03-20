import { Car } from "lucide-react";
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
      <Car 
        className={cn(
          "text-primary transition-colors duration-200",
          sizeClasses[size]
        )} 
      />
      <div 
        className={cn(
          "absolute inset-0 bg-gradient-to-br from-transparent via-primary/10 to-primary/30 pointer-events-none",
          "rounded-sm opacity-75",
          sizeClasses[size]
        )}
        style={{
          maskImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h20v20H0V0zm2 2v16h16V2H2zm2 2h12v12H4V4zm2 2v8h8V6H6z' fill='%23000'/%3E%3C/svg%3E")`,
          maskSize: '33% 33%',
          WebkitMaskImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h20v20H0V0zm2 2v16h16V2H2zm2 2h12v12H4V4zm2 2v8h8V6H6z' fill='%23000'/%3E%3C/svg%3E")`,
          WebkitMaskSize: '33% 33%'
        }}
      />
    </div>
  );
}