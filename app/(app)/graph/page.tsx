import { GraphView } from "@/components/graph-view";
import { getData } from "@/lib/data";

export default async function GraphPage() {
  const { items, categories, dependencies } = await getData();
  return <GraphView items={items} categories={categories} dependencies={dependencies} />;
}
