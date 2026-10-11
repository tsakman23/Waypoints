"use client";

import { createContext, Fragment, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line, OrbitControls, Trail } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { Vector3 } from "three";
import type * as THREE from "three";
import { Lock } from "lucide-react";
import { ItemEditor } from "@/components/item-editor";
import { TodaySortable } from "@/components/today-sortable";
import type { Session } from "@/lib/planner";
import { orbitPosition, type Planet, type SolarSystem } from "@/lib/solar";
import type { Category, Dependency, Item } from "@/lib/types";

/** Seconds the ship takes to fly between two planets on the route. */
const LEG_SECONDS = 4;
const LOCKED_GREY = "#5b6286";

// One clock for the whole scene ---------------------------------------------------
// Every planet, the route line and the ship read the same time, so pausing it
// (on hover, or with motion off) freezes them all consistently.

type Clock = { time: React.RefObject<number>; ship: React.RefObject<number> };
const ClockContext = createContext<Clock | null>(null);
const useClock = () => useContext(ClockContext)!;

/** Where a planet is in world space at time `t`: its sun's position plus its orbit. */
function worldPosition(system: SolarSystem, planet: Planet, t: number): [number, number, number] {
  const [x, y, z] = orbitPosition(planet.orbit, t);
  return [system.position[0] + x, y, system.position[1] + z];
}

/** Whether the viewer has asked their system for less motion. */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export function SolarSystemView({
  systems,
  today,
  animate,
  items,
  categories,
  dependencies,
}: {
  systems: SolarSystem[];
  /** Today's planned sessions, in the user's order. */
  today: Session[];
  /** The profile's "Animate the solar system" setting. */
  animate: boolean;
  items: Item[];
  categories: Category[];
  dependencies: Dependency[];
}) {
  const reducedMotion = usePrefersReducedMotion();
  const moving = animate && !reducedMotion;
  const [hovered, setHovered] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const time = useRef(0);
  const ship = useRef(0);

  // Today's order, updated the moment a stop is dragged (saving happens in
  // the background). A new order replays the ship's journey.
  const [order, setOrder] = useState(today);
  const signature = today.map((s) => s.item.id).join(",");
  useEffect(() => setOrder(today), [signature]); // eslint-disable-line react-hooks/exhaustive-deps
  const route = order.map((s) => s.item.id);
  const replay = () => {
    ship.current = 0;
  };
  const categoriesById = new Map(categories.map((c) => [c.id, c]));

  // Labels are ordinary HTML in one layer over the canvas. Each registers its
  // element here; LabelProjector moves them to their planet every frame.
  const labels = useRef(new Map<string, HTMLElement>());
  const register = (key: string) => (el: HTMLElement | null) => {
    if (el) labels.current.set(key, el);
    else labels.current.delete(key);
  };
  const hoveredPlanet = systems.flatMap((s) => s.planets.map((p) => ({ system: s, planet: p }))).find(
    ({ planet }) => planet.id === hovered,
  );

  // Pull the camera back far enough to see the whole galaxy.
  const extent = Math.max(20, ...systems.map((s) => Math.hypot(...s.position) + s.radius));

  return (
    <div className="fixed inset-0">
      <ClockContext.Provider value={{ time, ship }}>
        <Canvas camera={{ position: [0, extent * 0.9, extent * 1.25], fov: 50 }} dpr={[1, 2]} gl={{ alpha: true }}>
          <Ticker running={moving && hovered === null} />
          <ambientLight intensity={0.35} />
          {systems.map((system) => (
            <SystemView
              key={system.id}
              system={system}
              route={route}
              hovered={hovered}
              onHover={setHovered}
              onOpen={setEditing}
            />
          ))}
          <RouteLine systems={systems} route={route} />
          <Ship systems={systems} route={route} moving={moving} />
          <LabelProjector systems={systems} labels={labels} hovered={hovered} />
          <OrbitControls
            makeDefault
            enableDamping
            // Scroll zooms towards whatever is under the cursor, not the screen centre.
            zoomToCursor
            // 10% gentler than three.js's defaults (all 1).
            rotateSpeed={0.9}
            zoomSpeed={0.9}
            panSpeed={0.9}
            maxDistance={extent * 3}
            minDistance={6}
          />
          <EffectComposer>
            <Bloom mipmapBlur intensity={1.1} luminanceThreshold={0.35} luminanceSmoothing={0.2} />
          </EffectComposer>
        </Canvas>
      </ClockContext.Provider>

      {/* The label layer. Everything starts hidden at the top-left corner;
          LabelProjector positions and reveals it on the first frame. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden select-none">
        {systems.map((system) => (
          <Fragment key={system.id}>
            <span
              ref={register(`sun:${system.id}`)}
              className="invisible absolute top-0 left-0 font-heading text-sm font-bold tracking-wider whitespace-nowrap text-foreground [text-shadow:0_0_12px_rgb(0_0_0)]"
            >
              {system.name}
            </span>
            {system.planets.map((planet) => (
              <Fragment key={planet.id}>
                <span
                  ref={register(`label:${planet.id}`)}
                  className={`invisible absolute top-0 left-0 font-heading text-[11px] tracking-wide whitespace-nowrap text-foreground transition-opacity duration-200 [text-shadow:0_0_10px_rgb(0_0_0)] ${
                    route.includes(planet.id) || hovered === planet.id ? "opacity-100" : "opacity-0"
                  }`}
                >
                  {planet.title}
                </span>
                {planet.tier === "locked" && (
                  <span ref={register(`lock:${planet.id}`)} className="invisible absolute top-0 left-0">
                    <Lock className="size-3.5 text-white/80 drop-shadow" />
                  </span>
                )}
              </Fragment>
            ))}
          </Fragment>
        ))}
        {hoveredPlanet && (
          <div
            ref={register("card")}
            className="invisible absolute top-0 left-0 w-56 rounded-xl border border-border bg-[rgb(12_16_44/0.88)] p-3 text-xs shadow-[0_12px_40px_rgb(0_0_0/0.45)] backdrop-blur-xl"
          >
            <div className="font-heading text-sm font-semibold text-foreground">{hoveredPlanet.planet.title}</div>
            <div className="mt-0.5 text-muted-foreground capitalize">
              {hoveredPlanet.system.name} · {hoveredPlanet.planet.tier}
            </div>
            {hoveredPlanet.planet.lockedBy.length > 0 && (
              <div className="mt-2 text-muted-foreground">
                To unlock this, complete:
                <ul className="mt-1 list-disc pl-4 text-foreground">
                  {hoveredPlanet.planet.lockedBy.map((title) => (
                    <li key={title}>{title}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Today's route: drag to choose the order; the ship flies it. */}
      {order.length > 0 && (
        <div className="wp-glass absolute bottom-16 left-4 z-10 flex w-72 flex-col gap-2 rounded-2xl p-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-xs font-semibold tracking-[0.14em] text-cyan uppercase">Today&apos;s route</h2>
            <button
              type="button"
              onClick={replay}
              disabled={!moving}
              className="cursor-pointer rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:border-violet/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              Replay journey
            </button>
          </div>
          <TodaySortable
            sessions={order}
            onOrderChange={(next) => {
              setOrder(next);
              replay();
            }}
            className="flex flex-col gap-1"
            renderItem={(session, grip) => {
              const category = session.item.category_id ? categoriesById.get(session.item.category_id) : undefined;
              return (
                <div
                  className="wp-row flex items-center gap-2 rounded-lg py-1 pr-2"
                  style={category ? ({ "--c": category.color } as React.CSSProperties) : undefined}
                >
                  {grip}
                  {category ? <span className="wp-dot" /> : <span className="size-2.5" />}
                  <button
                    type="button"
                    onClick={() => setEditing(session.item.id)}
                    className="min-w-0 flex-1 cursor-pointer truncate text-left text-sm"
                  >
                    {session.item.title}
                  </button>
                </div>
              );
            }}
          />
        </div>
      )}

      <p className="pointer-events-none absolute bottom-5 left-1/2 hidden -translate-x-1/2 rounded-full border border-border bg-card px-4 py-1.5 text-xs text-muted-foreground backdrop-blur-xl sm:block">
        Each sun is an interest · drag to orbit, scroll to zoom · the ship flies today's route
      </p>

      {editing && (
        <ItemEditor
          key={editing}
          item={items.find((i) => i.id === editing)}
          items={items}
          categories={categories}
          dependencies={dependencies}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

/** Advances the shared clock every frame while the scene is running. */
function Ticker({ running }: { running: boolean }) {
  const { time, ship } = useClock();
  useFrame((_, delta) => {
    // Clamp delta so a backgrounded tab doesn't make everything jump.
    const step = Math.min(delta, 0.1);
    if (running) time.current += step;
    if (running) ship.current += step;
  });
  return null;
}

/** A sun, its orbits and its planets. */
function SystemView({
  system,
  route,
  hovered,
  onHover,
  onOpen,
}: {
  system: SolarSystem;
  route: string[];
  hovered: string | null;
  onHover: (id: string | null) => void;
  onOpen: (id: string) => void;
}) {
  const [x, z] = system.position;
  return (
    <group>
      {/* The sun: unlit and bright, so bloom makes it glow; its light colours nearby planets. */}
      <mesh position={[x, 0, z]}>
        <sphereGeometry args={[1.6, 48, 48]} />
        <meshBasicMaterial color={system.color} toneMapped={false} />
      </mesh>
      <pointLight position={[x, 0, z]} color={system.color} intensity={60} distance={system.radius * 2.2} decay={1.4} />

      {system.planets.map((planet) => (
        <group key={planet.id}>
          <OrbitPath system={system} planet={planet} />
          <PlanetView
            system={system}
            planet={planet}
            onRoute={route.includes(planet.id)}
            isHovered={hovered === planet.id}
            onHover={onHover}
            onOpen={onOpen}
          />
        </group>
      ))}
    </group>
  );
}

/** The ellipse a planet travels, sampled once. */
function OrbitPath({ system, planet }: { system: SolarSystem; planet: Planet }) {
  const points = useMemo(
    () => Array.from({ length: 97 }, (_, i) => worldPosition(system, planet, (i / 96) * planet.orbit.period)),
    [system, planet],
  );
  return (
    <Line
      points={points}
      color={planet.tier === "locked" ? LOCKED_GREY : system.color}
      lineWidth={1}
      transparent
      opacity={planet.tier === "available" ? 0.28 : 0.12}
      dashed={planet.tier !== "available"}
      dashSize={0.6}
      gapSize={0.6}
    />
  );
}

/** One planet: moves along its orbit each frame, glows on hover, opens on click. */
function PlanetView({
  system,
  planet,
  onRoute,
  isHovered,
  onHover,
  onOpen,
}: {
  system: SolarSystem;
  planet: Planet;
  onRoute: boolean;
  isHovered: boolean;
  onHover: (id: string | null) => void;
  onOpen: (id: string) => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const { time } = useClock();
  useFrame(() => ref.current?.position.set(...worldPosition(system, planet, time.current)));

  const locked = planet.tier === "locked";
  const color = locked ? LOCKED_GREY : system.color;

  return (
    <group ref={ref} position={worldPosition(system, planet, 0)}>
      {/* An invisible, larger hit area: planets are small and moving, so the
          pointer needs a generous target. Hovering it pauses the scene. */}
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(planet.id);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          onHover(null);
          document.body.style.cursor = "";
        }}
        onClick={(e) => {
          e.stopPropagation();
          onOpen(planet.id);
        }}
      >
        <sphereGeometry args={[Math.max(1.3, planet.radius * 2.2), 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh scale={isHovered ? 1.25 : 1}>
        <sphereGeometry args={[planet.radius, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          // Planets on this week's route and the hovered one glow a little.
          emissiveIntensity={isHovered ? 0.9 : onRoute ? 0.45 : planet.tier === "available" ? 0.15 : 0.05}
          roughness={0.55}
          metalness={0.1}
          transparent={planet.tier === "parked" || planet.tier === "done"}
          opacity={planet.tier === "done" ? 0.35 : planet.tier === "parked" ? 0.55 : 1}
          wireframe={planet.tier === "parked"}
        />
      </mesh>

    </group>
  );
}

/** The planned route's stops, in order, with repeats of the same planet collapsed. */
function useRouteStops(systems: SolarSystem[], route: string[]) {
  return useMemo(() => {
    const where = new Map<string, { system: SolarSystem; planet: Planet }>();
    for (const system of systems) for (const planet of system.planets) where.set(planet.id, { system, planet });
    return route
      .filter((id, i) => id !== route[i - 1])
      .map((id) => where.get(id))
      .filter((stop): stop is { system: SolarSystem; planet: Planet } => stop !== undefined);
  }, [systems, route]);
}

/** Violet at the first stop to cyan at the last, bright enough to bloom. */
function routeColours(count: number): [number, number, number][] {
  const violet = [0.55, 0.42, 1], cyan = [0.24, 0.88, 0.96];
  return Array.from({ length: count }, (_, i) => {
    const t = count > 1 ? i / (count - 1) : 0;
    // Above 1: three.js treats these as extra-bright, and bloom makes them glow.
    return violet.map((v, k) => (v + (cyan[k] - v) * t) * 1.8) as [number, number, number];
  });
}

/**
 * Today's path of light through the route's planets, following them as they
 * orbit: a glowing line (violet to cyan in travel order) with dashes of
 * light flowing along it in the direction you'll go.
 */
function RouteLine({ systems, route }: { systems: SolarSystem[]; route: string[] }) {
  const stops = useRouteStops(systems, route);
  const { time } = useClock();
  const glow = useRef<React.ComponentRef<typeof Line>>(null);
  const flow = useRef<React.ComponentRef<typeof Line>>(null);
  const initial = useMemo(() => stops.map(({ system, planet }) => worldPosition(system, planet, 0)), [stops]);
  const colours = useMemo(() => routeColours(stops.length), [stops.length]);

  useFrame((_, delta) => {
    if (stops.length < 2) return;
    const positions = stops.flatMap(({ system, planet }) => worldPosition(system, planet, time.current));
    for (const line of [glow.current, flow.current]) {
      if (!line) continue;
      line.geometry.setPositions(positions);
      line.computeLineDistances();
    }
    // Slide the dashes forward: the path shows which way you're heading.
    if (flow.current) flow.current.material.dashOffset -= Math.min(delta, 0.1) * 2;
  });

  if (stops.length < 2) return null;
  return (
    <>
      <Line ref={glow} points={initial} vertexColors={colours} lineWidth={3.5} toneMapped={false} transparent opacity={0.9} />
      <Line
        ref={flow}
        points={initial}
        color="#ffffff"
        lineWidth={1.4}
        dashed
        dashSize={0.5}
        gapSize={2.5}
        toneMapped={false}
        transparent
        opacity={0.85}
      />
    </>
  );
}

/**
 * The spaceship tells the day's story once: it flies the stops in order,
 * returns to the first, and parks in a slow orbit around it, where your day
 * starts. "Replay journey" (or reordering) flies it again.
 */
function Ship({ systems, route, moving }: { systems: SolarSystem[]; route: string[]; moving: boolean }) {
  const stops = useRouteStops(systems, route);
  const { time, ship } = useClock();
  const ref = useRef<THREE.Group>(null);

  useFrame(() => {
    const group = ref.current;
    if (!group || stops.length === 0) return;
    const at = (i: number) => worldPosition(stops[i].system, stops[i].planet, time.current);

    // Out through every stop, then one leg back to the first.
    const legs = stops.length > 1 ? stops.length : 0;
    const progress = ship.current / LEG_SECONDS;
    if (!moving || progress >= legs) {
      // Parked: a slow orbit around today's first planet.
      const [x, y, z] = at(0);
      const r = stops[0].planet.radius + 1.1;
      const angle = moving ? ship.current * 0.8 : 0;
      const next: [number, number, number] = [x + Math.cos(angle) * r, y + 0.5, z + Math.sin(angle) * r];
      group.lookAt(x + Math.cos(angle + 0.3) * r, y + 0.5, z + Math.sin(angle + 0.3) * r);
      group.position.set(...next);
      return;
    }
    const leg = Math.floor(progress);
    const f = progress - leg;
    const ease = f * f * (3 - 2 * f); // smoothstep: speed up, cruise, slow down
    const a = at(leg);
    const b = at((leg + 1) % stops.length);
    const lift = Math.sin(Math.PI * f) * Math.min(8, Math.hypot(b[0] - a[0], b[2] - a[2]) * 0.2);
    const next: [number, number, number] = [
      a[0] + (b[0] - a[0]) * ease,
      a[1] + (b[1] - a[1]) * ease + 1 + lift,
      a[2] + (b[2] - a[2]) * ease,
    ];
    group.lookAt(...next);
    group.position.set(...next);
  });

  if (stops.length === 0) return null;
  return (
    <Trail width={1.2} length={6} color="#3ee0f5" attenuation={(w) => w * w}>
      <group ref={ref}>
        {/* A small arrowhead pointing where it's heading. */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.35, 1.1, 12]} />
          <meshBasicMaterial color="#bff6ff" toneMapped={false} />
        </mesh>
      </group>
    </Trail>
  );
}

/**
 * Keeps the HTML labels over their 3D objects: every frame, works out where
 * each anchor lands on screen (vector.project) and moves its element there.
 * Writes styles directly instead of through React state, which at 60 frames
 * a second would re-render far too much.
 */
function LabelProjector({
  systems,
  labels,
  hovered,
}: {
  systems: SolarSystem[];
  labels: React.RefObject<Map<string, HTMLElement>>;
  hovered: string | null;
}) {
  const { time } = useClock();
  const point = useMemo(() => new Vector3(), []);

  useFrame(({ camera, size }) => {
    /** Put element `key` at a world position; `shift` says which part of it sits on the point. */
    const place = (key: string, [x, y, z]: [number, number, number], shift: string) => {
      const el = labels.current.get(key);
      if (!el) return;
      point.set(x, y, z).project(camera);
      // Behind the camera: hide rather than draw it mirrored.
      if (point.z > 1) {
        el.style.visibility = "hidden";
        return;
      }
      const sx = ((point.x + 1) / 2) * size.width;
      const sy = ((1 - point.y) / 2) * size.height;
      el.style.transform = `translate(${sx}px, ${sy}px) ${shift}`;
      el.style.visibility = "visible";
    };

    for (const system of systems) {
      const [x, z] = system.position;
      place(`sun:${system.id}`, [x, -2.6, z], "translate(-50%, 0)");
      for (const planet of system.planets) {
        const [px, py, pz] = worldPosition(system, planet, time.current);
        place(`label:${planet.id}`, [px, py - planet.radius - 0.6, pz], "translate(-50%, 0)");
        place(`lock:${planet.id}`, [px, py, pz], "translate(-50%, -50%)");
        if (planet.id === hovered) place("card", [px + planet.radius + 0.6, py, pz], "translate(0, -50%)");
      }
    }
  });
  return null;
}
