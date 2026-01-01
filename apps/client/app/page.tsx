import { BikeMap } from "@/components/BikeMap";
import { Search } from "@/components/Search";

export default function Home() {
  return (
    <div className="h-dvh w-screen overflow-hidden">
      <BikeMap />
      <Search />
    </div>
  );
}
