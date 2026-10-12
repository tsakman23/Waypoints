import type { Metadata } from "next";
import { Landing } from "@/components/landing";

export const metadata: Metadata = {
  title: "Waypoints · Chart a course through your interests",
  description:
    "A planner for everything you want to do: one interest per session, rotating so none of them fades, with skills brought back before they're forgotten.",
};

/** The landing page for signed-out visitors (signed-in ones go to their week). */
export default function Home() {
  return <Landing variant="public" />;
}
