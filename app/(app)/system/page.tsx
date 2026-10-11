import { SolarSystemView } from "@/components/solar-system";
import { getData, getProfile, getWorkLogs } from "@/lib/data";
import { planRoutes } from "@/lib/planner";
import { localDay } from "@/lib/profile";
import { layoutGalaxy } from "@/lib/solar";

/** The solar system: interests as suns, items as planets, today as a ship's route. */
export default async function SystemPage() {
  const [{ items, categories, dependencies }, profile, workLogs] = await Promise.all([
    getData(),
    getProfile(),
    getWorkLogs(),
  ]);
  // No profile yet: the layout is showing the setup wizard instead.
  if (!profile) return null;

  // The same plan as Next up, in the user's own order for today.
  const { main } = planRoutes({
    items,
    dependencies,
    categories,
    workLogs,
    profile,
    today: localDay(new Date(), profile.timezone),
  });

  return (
    <SolarSystemView
      systems={layoutGalaxy(items, categories, dependencies)}
      today={main.days[0]?.sessions ?? []}
      categories={categories}
      animate={profile.animate_orbits}
      items={items}
      dependencies={dependencies}
    />
  );
}
