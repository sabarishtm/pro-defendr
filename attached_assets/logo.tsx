import { useTheme } from "@/hooks/use-theme";
import { Shield } from "lucide-react";

export default function Logo({ className = "" }: { className?: string }) {
  const isDark = useTheme();

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <img 
        src="/Sutherland_R_Logo_Horiz_RGB.png"
        alt="Sutherland Logo"
        className="h-full object-contain"
        style={{
          filter: isDark ? "brightness(0) invert(1)" : "none"
        }}
      />
      <div className="flex items-center gap-1 text-[#6366f1]">
        <Shield className="w-5 h-5" />
        <span className="font-semibold text-lg">Defendr</span>
      </div>
    </div>
  );
}