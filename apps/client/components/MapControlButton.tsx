import { forwardRef, type ReactNode } from "react";

interface MapControlButtonProps {
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}

export const MapControlButton = forwardRef<HTMLButtonElement, MapControlButtonProps>(
  ({ onClick, children, disabled }, ref) => {
    return (
      <button
        ref={ref}
        onClick={onClick}
        disabled={disabled}
        className="flex items-center justify-between gap-3 bg-black/45 hover:bg-black/55 hover:scale-[1.02] active:scale-95 text-white/90 text-sm font-medium pl-2.5 pr-2.5 py-2 sm:pl-2 sm:pr-2 sm:py-1.5 rounded-full border border-white/10 backdrop-blur-md transition-all duration-200 ease-out shadow-[0_0_20px_rgba(0,0,0,0.6)] hover:duration-100 active:duration-200 outline-none disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100"
      >
        {children}
      </button>
    );
  }
);

MapControlButton.displayName = "MapControlButton";
