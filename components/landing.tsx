import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * What Waypoints is and how it works. "public" is the landing page at / for
 * signed-out visitors; "member" is the same story at /how-it-works, inside
 * the app, for anyone who wants a refresher.
 */
export function Landing({ variant }: { variant: "public" | "member" }) {
  const cta =
    variant === "public" ? { href: "/login", label: "Get started" } : { href: "/next", label: "Back to your week" };

  return (
    <div className="flex flex-col">
      {variant === "public" && (
        <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 pt-6 sm:px-8">
          <span className="flex items-center gap-2 font-heading text-lg font-bold tracking-wide">
            <span className="size-2 rounded-full bg-cyan shadow-[0_0_12px_var(--cyan)]" />
            Waypoints
          </span>
          <Button asChild variant="outline" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
        </header>
      )}

      {/* Hero */}
      <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 pt-16 pb-20 text-center sm:pt-24">
        <span className="text-xs font-semibold tracking-[0.18em] text-cyan uppercase">
          A planner for everything you want to do
        </span>
        <h1 className="font-heading text-4xl leading-tight font-bold tracking-wide text-balance sm:text-5xl">
          Chart a course through your{" "}
          <span className="bg-(image:--glow) bg-clip-text text-transparent">interests</span>
        </h1>
        <p className="max-w-xl text-lg text-pretty text-muted-foreground">
          You want to get back to the piano, run a 10k, learn Rust, and finally read the books piling up on your shelf.
          Waypoints turns all of it into a week you can follow, one session at a time, rotating between interests so
          none of them fades.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="px-6">
            <Link href={cta.href}>{cta.label}</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="px-6">
            <a href="#how">See how it works</a>
          </Button>
        </div>
      </section>

      {/* The five steps */}
      <section id="how" className="mx-auto flex w-full max-w-5xl scroll-mt-24 flex-col gap-20 px-4 pb-24 sm:px-8">
        <Step
          number={1}
          title="Add what you want to do"
          illustration={<AddIllustration />}
        >
          Every project or skill becomes an item. Rate how much you want it, how much it matters, and how much work it
          is, and group items into interests like Music or Software.
        </Step>
        <Step number={2} title="Connect what leads to what" illustration={<ConnectIllustration />} flip>
          Writing a compiler needs Rust first. Link items to their prerequisites, and Waypoints keeps the locked ones
          out of the way until you&apos;re ready for them.
        </Step>
        <Step number={3} title="Get a plan for your week" illustration={<PlanIllustration />}>
          Tell it how much time you have. Waypoints gives each session to one interest, rotates between them, and
          brings back any skill you haven&apos;t touched in a while before it starts to fade. It only plans projects
          you&apos;ve made active, so ideas stay ideas until you commit.
        </Step>
        <Step number={4} title="Check in each morning" illustration={<CheckInIllustration />} flip>
          One tap: what did you work on yesterday? The plan adapts to what you actually did. Drag today&apos;s sessions
          into the order you&apos;ll do them.
        </Step>
        <Step number={5} title="Fly it as a solar system" illustration={<SolarIllustration />}>
          Each interest is a sun and its projects are planets, closer in when they&apos;re ready to start. A ship flies
          today&apos;s route between them.
        </Step>
      </section>

      {/* Why it works */}
      <section className="mx-auto w-full max-w-5xl px-4 pb-24 sm:px-8">
        <div className="wp-glass flex flex-col gap-3 rounded-3xl p-8 sm:p-10">
          <h2 className="font-heading text-xl font-bold tracking-wide">Built on how skills are learned</h2>
          <ul className="grid gap-4 text-muted-foreground sm:grid-cols-3">
            <li>
              <span className="block font-semibold text-foreground">Spacing beats cramming</span>
              Coming back to a skill every so often keeps it better than long single sessions.
            </li>
            <li>
              <span className="block font-semibold text-foreground">Skills fade at different speeds</span>
              Fitness drops in weeks, an instrument over months. Each interest gets its own clock.
            </li>
            <li>
              <span className="block font-semibold text-foreground">Finish what you start</span>
              Only active projects are planned, so you make progress instead of collecting beginnings.
            </li>
          </ul>
        </div>
      </section>

      {/* What it learns from the check-ins */}
      <section className="mx-auto w-full max-w-5xl px-4 pb-24 sm:px-8">
        <div className="wp-glass flex flex-col gap-3 rounded-3xl p-8 sm:p-10">
          <h2 className="font-heading text-xl font-bold tracking-wide">It learns from you</h2>
          <p className="text-muted-foreground">
            Each check-in is compared with what was planned for that day. Over time the plan leans towards what you
            actually do.
          </p>
          <ul className="grid gap-4 text-muted-foreground sm:grid-cols-3">
            <li>
              <span className="block font-semibold text-foreground">What you skip</span>
              Things you keep skipping come up a little less, and things you do anyway a little more. A few days
              barely move it; weeks of the same pattern do.
            </li>
            <li>
              <span className="block font-semibold text-foreground">Your own rhythm</span>
              If you really come back to running every 10 days, not 7, its clock slowly shifts towards 10.
            </li>
            <li>
              <span className="block font-semibold text-foreground">Your settings win</span>
              Set an interest&apos;s interval yourself and it&apos;s used as it is. Today&apos;s plan says when
              something it learned is behind a suggestion.
            </li>
          </ul>
        </div>
      </section>

      {/* Final call to action */}
      <section className="mx-auto flex max-w-2xl flex-col items-center gap-5 px-4 pb-28 text-center">
        <h2 className="font-heading text-2xl font-bold tracking-wide sm:text-3xl">Ready when you are</h2>
        <p className="text-muted-foreground">Set your time, add a few interests, and see your first week in a minute.</p>
        <Button asChild size="lg" className="px-8">
          <Link href={cta.href}>{cta.label}</Link>
        </Button>
      </section>
    </div>
  );
}

function Step({
  number,
  title,
  illustration,
  flip = false,
  children,
}: {
  number: number;
  title: string;
  illustration: React.ReactNode;
  /** Put the illustration on the left, for an alternating zig-zag. */
  flip?: boolean;
  children: React.ReactNode;
}) {
  return (
    <article className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
      <div className={cn("flex flex-col gap-3", flip && "md:order-2")}>
        <span className="font-heading text-sm font-bold tracking-[0.2em] text-cyan">0{number}</span>
        <h2 className="font-heading text-2xl font-bold tracking-wide text-balance">{title}</h2>
        <p className="text-lg leading-relaxed text-pretty text-muted-foreground">{children}</p>
      </div>
      {/* Wide and short when stacked on narrow screens, 4:3 beside the text. */}
      <div className="wp-glass flex aspect-[16/9] items-center justify-center overflow-hidden rounded-3xl p-4 md:aspect-[4/3] md:p-6">
        {illustration}
      </div>
    </article>
  );
}

// Illustrations -------------------------------------------------------------------
// Small SVG scenes animated with the keyframes in globals.css. They finish in
// a complete picture, so with reduced motion each is simply a still.

const VIOLET = "var(--violet)";
const CYAN = "var(--cyan)";
const MAGENTA = "var(--magenta)";

function AddIllustration() {
  const bars = [
    { label: "Interest", value: 0.9 },
    { label: "Impact", value: 0.7 },
    { label: "Effort", value: 0.45 },
  ];
  return (
    <svg viewBox="0 0 320 240" className="h-full w-full max-w-md" role="img" aria-label="A new star with its three scores">
      <circle cx="90" cy="120" r="46" fill={VIOLET} opacity="0.25" className="wp-breathe" />
      <circle cx="90" cy="120" r="30" fill={VIOLET} className="wp-appear" />
      <circle cx="80" cy="110" r="9" fill="white" opacity="0.35" className="wp-appear" />
      {bars.map((bar, i) => (
        <g key={bar.label} transform={`translate(160 ${82 + i * 34})`}>
          <text y="-6" fontSize="11" fill="var(--muted-foreground)" fontFamily="var(--font-sora)">
            {bar.label}
          </text>
          <rect width="130" height="8" rx="4" fill="rgb(255 255 255 / 0.08)" />
          <rect
            width={130 * bar.value}
            height="8"
            rx="4"
            fill={CYAN}
            className="wp-fill"
            style={{ animationDelay: `${400 + i * 250}ms` }}
          />
        </g>
      ))}
    </svg>
  );
}

function ConnectIllustration() {
  return (
    <svg viewBox="0 0 320 240" className="h-full w-full max-w-md" role="img" aria-label="Learn Rust leading to Write a compiler, which is locked until then">
      <line
        x1="98"
        y1="120"
        x2="222"
        y2="120"
        stroke={CYAN}
        strokeWidth="3"
        strokeLinecap="round"
        className="wp-draw"
        style={{ "--len": 124 } as React.CSSProperties}
      />
      <circle cx="70" cy="120" r="28" fill={VIOLET} />
      <circle cx="250" cy="120" r="34" fill="rgb(154 163 199 / 0.35)" stroke="rgb(154 163 199 / 0.6)" strokeDasharray="4 4" />
      {/* A padlock on the locked goal. */}
      <g transform="translate(238 104)" stroke="white" strokeWidth="2.5" fill="none" opacity="0.85">
        <rect x="0" y="12" width="24" height="18" rx="3" />
        <path d="M5 12 V7 a7 7 0 0 1 14 0 V12" />
      </g>
      <text x="70" y="176" textAnchor="middle" fontSize="12" fill="var(--foreground)" fontFamily="var(--font-sora)">
        Learn Rust
      </text>
      <text x="250" y="182" textAnchor="middle" fontSize="12" fill="var(--muted-foreground)" fontFamily="var(--font-sora)">
        Write a compiler
      </text>
    </svg>
  );
}

function PlanIllustration() {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  // Two sessions a day across four interests, mixed the way a real plan is:
  // never the same interest twice in a day, each one coming back every few days.
  const colours = [VIOLET, CYAN, MAGENTA, "#f59e0b"];
  const week = [[0, 1], [2, 3], [1, 0], [3, 2], [0, 2], [1, 3], [2, 0]];
  return (
    <svg viewBox="0 0 320 240" className="h-full w-full max-w-md" role="img" aria-label="A week of sessions rotating between four interests">
      {days.map((day, d) => (
        <g key={d} transform={`translate(${34 + d * 42} 0)`}>
          <text x="0" y="70" textAnchor="middle" fontSize="12" fill="var(--muted-foreground)" fontFamily="var(--font-sora)">
            {day}
          </text>
          {[0, 1].map((s) => {
            const n = d * 2 + s;
            return (
              <circle
                key={s}
                cx="0"
                cy={105 + s * 44}
                r="13"
                fill={colours[week[d][s]]}
                className="wp-pop"
                style={{ "--delay": `${n * 120}ms` } as React.CSSProperties}
              />
            );
          })}
        </g>
      ))}
    </svg>
  );
}

function CheckInIllustration() {
  const rows = ["Run a 5k", "Music theory", "Daily journaling"];
  return (
    <svg viewBox="0 0 320 240" className="h-full w-full max-w-md" role="img" aria-label="Yesterday's check-in with two items ticked">
      <text x="40" y="58" fontSize="13" fill="var(--foreground)" fontFamily="var(--font-sora)" fontWeight="600">
        What did you work on yesterday?
      </text>
      {rows.map((row, i) => {
        const ticked = i < 2;
        return (
          <g key={row} transform={`translate(40 ${84 + i * 44})`}>
            <rect
              width="22"
              height="22"
              rx="6"
              fill={ticked ? VIOLET : "transparent"}
              stroke={ticked ? VIOLET : "rgb(255 255 255 / 0.25)"}
              strokeWidth="1.5"
            />
            {ticked && (
              <path
                d="M6 11.5 l3.5 3.5 l7 -7.5"
                stroke="white"
                strokeWidth="2.4"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="wp-tick"
                style={{ "--delay": `${300 + i * 400}ms` } as React.CSSProperties}
              />
            )}
            <text x="36" y="16" fontSize="13" fill={ticked ? "var(--foreground)" : "var(--muted-foreground)"} fontFamily="var(--font-sora)">
              {row}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function SolarIllustration() {
  return (
    <svg viewBox="0 0 320 240" className="h-full w-full max-w-md" role="img" aria-label="A sun with two planets orbiting it">
      <ellipse cx="160" cy="120" rx="60" ry="60" fill="none" stroke="rgb(139 108 255 / 0.3)" />
      <ellipse cx="160" cy="120" rx="100" ry="100" fill="none" stroke="rgb(62 224 245 / 0.22)" strokeDasharray="4 6" />
      <circle cx="160" cy="120" r="34" fill={VIOLET} opacity="0.25" className="wp-breathe" />
      <circle cx="160" cy="120" r="22" fill={VIOLET} />
      <g className="wp-circle" style={{ "--period": "9s" } as React.CSSProperties}>
        <circle cx="220" cy="120" r="9" fill={CYAN} />
      </g>
      <g className="wp-circle" style={{ "--period": "18s" } as React.CSSProperties}>
        <circle cx="60" cy="120" r="12" fill={MAGENTA} />
        {/* The ship, keeping the outer planet company. */}
        <path d="M60 96 l6 12 h-12 z" fill="#bff6ff" />
      </g>
    </svg>
  );
}
