import { formatDateShort, formatTimeOnly } from "@/lib/format";
import { useAnimationStore } from "@/lib/stores/animation-store";
import { Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

type Props = {
  simulationTime: number; // seconds from animation start
  startDate: Date; // animation start date
};

export function TimeDisplay({ simulationTime, startDate }: Props) {
  const isLoadingTrips = useAnimationStore((s) => s.isLoadingTrips);
  const displayTimeMs = startDate.getTime() + simulationTime * 1000;

  return (
    <div className="bg-black/45 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 shadow-[0_0_24px_rgba(0,0,0,0.6)] flex flex-col items-center">
      <AnimatePresence mode="wait">
        {isLoadingTrips ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex items-center justify-center py-1"
          >
            <Loader2 className="size-6 animate-spin text-white/70" />
          </motion.div>
        ) : (
          <motion.div
            key="time"
            initial={{ opacity: 0, filter: "blur(4px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(4px)" }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex flex-col items-center"
          >
            <div className="text-white/90 text-xs tracking-wide font-mono">
              {formatDateShort(displayTimeMs)}
            </div>
            <div className="text-xl font-semibold tabular-nums text-white/90 tracking-tight">
              {formatTimeOnly(displayTimeMs)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
