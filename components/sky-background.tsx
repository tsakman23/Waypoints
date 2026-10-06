/**
 * The night sky behind every page: drifting nebula clouds, twinkling stars
 * and an occasional shooting star. Rendered on the server; all motion is CSS
 * (see the "Sky background" section in globals.css).
 */

const STAR_COUNT = 170;

/** Same "random" stars on every render, so the sky doesn't reshuffle. */
function seededRandom(seed: number) {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

const random = seededRandom(11);
const stars = Array.from({ length: STAR_COUNT }, () => ({
  cx: random() * 1600,
  cy: random() * 1000,
  r: random() * 1.3 + 0.3,
  opacity: random() * 0.55 + 0.12,
  twinkles: random() > 0.55,
  duration: random() * 4 + 3,
  delay: random() * -6,
}));

export function SkyBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ background: "radial-gradient(130% 100% at 30% 0%, #151a4a 0%, var(--night) 40%, var(--void) 100%)" }}
    >
      <div className="sky-nebula sky-nebula-1" />
      <div className="sky-nebula sky-nebula-2" />
      <div className="sky-nebula sky-nebula-3" />
      <svg className="absolute inset-0 size-full" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="sky-shooting-tail" x1="0" x2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {stars.map((star, i) => (
          <circle
            key={i}
            cx={star.cx.toFixed(1)}
            cy={star.cy.toFixed(1)}
            r={star.r.toFixed(2)}
            fill="#e8ebf7"
            opacity={star.opacity.toFixed(2)}
            className={star.twinkles ? "sky-star" : undefined}
            style={
              star.twinkles
                ? ({
                    "--o": star.opacity.toFixed(2),
                    "--t": `${star.duration.toFixed(1)}s`,
                    "--d": `${star.delay.toFixed(1)}s`,
                  } as React.CSSProperties)
                : undefined
            }
          />
        ))}
        <line
          x1="1450"
          y1="90"
          x2="1560"
          y2="30"
          stroke="url(#sky-shooting-tail)"
          strokeWidth="1.6"
          strokeLinecap="round"
          className="sky-shooting"
        />
      </svg>
    </div>
  );
}
