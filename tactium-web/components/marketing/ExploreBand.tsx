import { ExploreBandClient } from "./ExploreBandClient";
import type { HomeData } from "./explore-data";

/** Banda «Explorar sin cuenta». Los datos llegan del servidor ya cacheados. */
export function ExploreBand({ data }: { data: HomeData }) {
  return <ExploreBandClient initialTournaments={data.tournaments} featured={data.featured} />;
}
