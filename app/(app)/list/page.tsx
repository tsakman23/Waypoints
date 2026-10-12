import { ItemList } from "@/components/item-list";
import { getData } from "@/lib/data";

export default async function ListPage() {
  const { items, categories, dependencies } = await getData();
  return <ItemList items={items} categories={categories} dependencies={dependencies} />;
}
