import { PlanView } from "@/components/plan-view";
import { getData, getProfile, getWorkLogs } from "@/lib/data";
import { planRoutes } from "@/lib/planner";
import { localDay } from "@/lib/profile";

/** Next up: the planned week, day by day, with alternatives. */
export default async function NextUpPage() {
  const [{ items, categories, dependencies }, profile, workLogs] = await Promise.all([
    getData(),
    getProfile(),
    getWorkLogs(),
  ]);
  // No profile yet: the layout is showing the setup wizard instead.
  if (!profile) return null;

  const plan = planRoutes({
    items,
    dependencies,
    categories,
    workLogs,
    profile,
    today: localDay(new Date(), profile.timezone),
  });

  return <PlanView plan={plan} items={items} categories={categories} dependencies={dependencies} />;
}
