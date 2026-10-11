import { GraphView } from "@/components/graph-view";
import { getData, getProfile, getWorkLogs } from "@/lib/data";
import { planRoutes } from "@/lib/planner";
import { localDay } from "@/lib/profile";

export default async function GraphPage() {
  const [{ items, categories, dependencies }, profile, workLogs] = await Promise.all([
    getData(),
    getProfile(),
    getWorkLogs(),
  ]);
  // No profile yet: the layout is showing the setup wizard instead.
  if (!profile) return null;

  // The same plan Next up shows, so both views tell the same story.
  const { main } = planRoutes({
    items,
    dependencies,
    categories,
    workLogs,
    profile,
    today: localDay(new Date(), profile.timezone),
  });

  return <GraphView items={items} categories={categories} dependencies={dependencies} route={main} />;
}
