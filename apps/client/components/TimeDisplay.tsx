import { formatTime } from "@/lib/format";

type Props = {
  simulationTime: number; // seconds from animation start
  startDate: Date; // animation start date
};

export function TimeDisplay({ simulationTime, startDate }: Props) {
  const displayTimeMs = startDate.getTime() + simulationTime * 1000;

  return (
    <div className="pointer-events-none">
      <div className="bg-black/45 backdrop-blur-md text-white/90 text-xs px-3 py-1.5 rounded-full border border-white/10 tracking-wide font-mono shadow-[0_0_24px_rgba(0,0,0,0.6)]">
        {formatTime(displayTimeMs)}
      </div>
    </div>
  );
}
