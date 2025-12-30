import { BikeMap } from "@/components/BikeMap";
import { Search } from "@/components/Search";
import { Settings } from "@/components/Settings";

export default function Home() {
  return (
    <div className="h-screen w-screen">
      <BikeMap />
      <Search />
      <Settings />
    </div>
  );
}
