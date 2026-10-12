import type { Metadata } from "next";
import { Landing } from "@/components/landing";

export const metadata: Metadata = { title: "How Waypoints works" };

/** The landing page's explanation, inside the app, for a refresher. */
export default function HowItWorksPage() {
  // The app layout's main column has its own padding; pull the page back to full width.
  return (
    <div className="-mx-4 -mt-10 sm:-mx-8">
      <Landing variant="member" />
    </div>
  );
}
