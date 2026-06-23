/**
 * DeliveryMap — Leaflet + OpenStreetMap tiles with OSRM real road routing.
 *
 * Road geometry and travel durations both come from the OSRM public routing API
 * (same engine as openstreetmap.org/directions) — completely free, no API key.
 *
 * GPS coordinates are pinned to real Lyon streets so the routing is authentic.
 */
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import { useEffect, useState } from "react";
import type { OptimizedRoute } from "@/lib/routeOptimizer";

// ---------------------------------------------------------------------------
// GPS coordinates — real Lyon streets, proportional to seeded travel times
// ---------------------------------------------------------------------------
const COORDS: Record<string, [number, number]> = {
  R:  [45.7640, 4.8357], // Restaurant  · 1 Central Plaza
  C1: [45.7720, 4.8010], // Customer 1  · 10 Oak Street      (~12 min)
  C2: [45.7810, 4.8640], // Customer 2  · 22 Maple Avenue    (~18 min)
  C3: [45.7768, 4.8310], // Customer 3  · 5 Pine Road         (~9 min)
  C4: [45.7380, 4.8780], // Customer 4  · 88 Birch Lane      (~22 min)
  C5: [45.7370, 4.8290], // Customer 5  · 14 Elm Boulevard   (~15 min)
  C6: [45.7530, 4.8840], // Customer 6  · 33 Cedar Court     (~20 min)
  C7: [45.7790, 4.8490], // Customer 7  · 47 Walnut Drive    (~11 min)
  C8: [45.7310, 4.8620], // Customer 8  · 92 Cherry Way      (~25 min)
};

const ADDR: Record<string, string> = {
  R:  "Restaurant · 1 Central Plaza",
  C1: "Customer 1 · 10 Oak Street",
  C2: "Customer 2 · 22 Maple Avenue",
  C3: "Customer 3 · 5 Pine Road",
  C4: "Customer 4 · 88 Birch Lane",
  C5: "Customer 5 · 14 Elm Boulevard",
  C6: "Customer 6 · 33 Cedar Court",
  C7: "Customer 7 · 47 Walnut Drive",
  C8: "Customer 8 · 92 Cherry Way",
};

// ---------------------------------------------------------------------------
// OSRM — real road routing, 100% free, no key
// Single request for the full route; gives per-leg durations + road geometry
// ---------------------------------------------------------------------------
const OSRM = "https://router.project-osrm.org/route/v1/driving";

interface OsrmData {
  /** Full road-following polyline [lat, lng] (Leaflet order) */
  path: [number, number][];
  /** Real driving minutes per leg (leg i = stop i → stop i+1) */
  legMins: number[];
}

async function fetchOsrmRoute(stops: [number, number][]): Promise<OsrmData> {
  // OSRM expects lon,lat order
  const coords = stops.map(([lat, lng]) => `${lng},${lat}`).join(";");
  const res = await fetch(`${OSRM}/${coords}?overview=full&geometries=geojson`);
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  const json = await res.json();
  const route = json.routes?.[0];
  if (!route) throw new Error("No OSRM route returned");
  // Convert [lng, lat] → [lat, lng] for Leaflet
  const path: [number, number][] = route.geometry.coordinates.map(
    ([lng, lat]: [number, number]) => [lat, lng],
  );
  const legMins: number[] = route.legs.map((l: { duration: number }) =>
    Math.max(1, Math.round(l.duration / 60)),
  );
  return { path, legMins };
}

// ---------------------------------------------------------------------------
// Circular pin icon — avoids Leaflet's default icon asset issues in Vite
// ---------------------------------------------------------------------------
function createPin(color: string, label: string, size = 28): L.DivIcon {
  return L.divIcon({
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};border:2.5px solid white;
      box-shadow:0 2px 6px rgba(0,0,0,0.35);
      display:flex;align-items:center;justify-content:center;
      font-size:${size > 28 ? 13 : 10}px;font-weight:700;color:white;line-height:1;
    ">${label}</div>`,
    className: "",
    iconSize: [size, size] as L.PointExpression,
    iconAnchor: [size / 2, size / 2] as L.PointExpression,
    popupAnchor: [0, -(size / 2 + 6)] as L.PointExpression,
  });
}

function createDurationBadge(mins: number): L.DivIcon {
  return L.divIcon({
    html: `<div style="
      background:white;border:1.5px solid #6366f1;border-radius:9999px;
      padding:2px 7px;font-size:11px;font-weight:700;color:#6366f1;
      white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.15);
    ">${mins} min</div>`,
    className: "",
    iconAnchor: [24, 10] as L.PointExpression,
  });
}

// ---------------------------------------------------------------------------
// AutoFitBounds — fits the viewport to all 9 pins once on mount
// ---------------------------------------------------------------------------
function AutoFitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      map.fitBounds(L.latLngBounds(positions), { padding: [40, 40] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);
  return null;
}

// ---------------------------------------------------------------------------
// DeliveryMap
// ---------------------------------------------------------------------------
interface Props {
  accepted: any[];
  available: any[];
  optimized: OptimizedRoute | null;
}

export function DeliveryMap({ accepted, available, optimized }: Props) {
  const acceptedCodes = new Set(
    accepted.map((o: any) => o.customers?.code).filter(Boolean),
  );
  const availableCodes = new Set(
    available.map((o: any) => o.customers?.code).filter(Boolean),
  );

  const routeStops = optimized?.stops.map((s) => s.code) ?? [];
  const routePositions = routeStops
    .map((code) => COORDS[code])
    .filter(Boolean) as [number, number][];

  // Travel time from the restaurant to every customer location (fetched once on mount)
  const [travelFromR, setTravelFromR] = useState<Record<string, number>>({});

  useEffect(() => {
    const allCodes = ["R", "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"];
    const coords = allCodes
      .map((c) => COORDS[c])
      .map(([lat, lng]) => `${lng},${lat}`)
      .join(";");
    fetch(
      `https://router.project-osrm.org/table/v1/driving/${coords}?sources=0&annotations=duration`,
    )
      .then((r) => r.json())
      .then((data) => {
        const durations: (number | null)[] = data.durations?.[0];
        if (!durations) return;
        const result: Record<string, number> = {};
        allCodes.forEach((code, i) => {
          if (i > 0 && durations[i] != null)
            result[code] = Math.max(1, Math.round(durations[i]! / 60));
        });
        setTravelFromR(result);
      })
      .catch(console.error);
  }, []); // R's position never changes — run once

  // OSRM real road data — fetched when the active route changes
  const [osrm, setOsrm] = useState<OsrmData | null>(null);
  const [osrmLoading, setOsrmLoading] = useState(false);

  useEffect(() => {
    if (routePositions.length < 2) {
      setOsrm(null);
      return;
    }
    let cancelled = false;
    setOsrmLoading(true);
    fetchOsrmRoute(routePositions)
      .then((data) => { if (!cancelled) { setOsrm(data); setOsrmLoading(false); } })
      .catch(() => { if (!cancelled) setOsrmLoading(false); });
    return () => { cancelled = true; };
    // Key on stop order, not the positions array reference
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeStops.join(",")]);

  // Midpoints for duration badges — geometric midpoint between consecutive stops
  const legMidpoints: { pos: [number, number]; mins: number }[] = [];
  if (osrm) {
    routeStops.slice(0, -1).forEach((code, i) => {
      const from = COORDS[routeStops[i]];
      const to   = COORDS[routeStops[i + 1]];
      if (from && to && osrm.legMins[i] !== undefined) {
        legMidpoints.push({
          pos: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2],
          mins: osrm.legMins[i],
        });
      }
    });
  }

  return (
    <div className="space-y-2">
      <div
        className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700"
        style={{ height: 400 }}
      >
        <MapContainer
          center={COORDS.R}
          zoom={13}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <AutoFitBounds positions={Object.values(COORDS)} />

          {/* Road-following polyline from OSRM, fallback to straight line while loading */}
          {routePositions.length > 1 && (
            <Polyline
              positions={osrm ? osrm.path : routePositions}
              pathOptions={{ color: "#6366f1", weight: 4, opacity: osrm ? 0.85 : 0.4 }}
            />
          )}

          {/* Real travel-time badges at leg midpoints */}
          {legMidpoints.map((m, i) => (
            <Marker
              key={`dur-${i}`}
              position={m.pos}
              icon={createDurationBadge(m.mins)}
              interactive={false}
            />
          ))}

          {/* Location markers */}
          {Object.entries(COORDS).map(([code, pos]) => {
            const isRestaurant = code === "R";
            const isAccepted   = acceptedCodes.has(code);
            const isAvailable  = availableCodes.has(code);
            const routeIdx     = routeStops.indexOf(code);
            const onRoute      = routeIdx >= 0;

            const color = isRestaurant ? "#f97316"
              : isAccepted  ? "#6366f1"
              : isAvailable ? "#eab308"
              : "#94a3b8";

            const label = isRestaurant ? "R"
              : onRoute && routeIdx > 0 ? String(routeIdx)
              : code.replace("C", "");

            const size = isRestaurant ? 34 : 28;

            // Per-stop real travel time from OSRM (leg ends at this stop)
            const legMinHere = osrm && routeIdx > 0 ? osrm.legMins[routeIdx - 1] : null;

            return (
              <Marker key={code} position={pos} icon={createPin(color, label, size)}>
                <Popup>
                  <div className="text-sm space-y-1 min-w-[160px]">
                    <p className="font-semibold leading-snug">{ADDR[code]}</p>
                    {isRestaurant && (
                      <p className="text-xs text-orange-600 font-medium">Departure point</p>
                    )}
                    {isAccepted && (
                      <>
                        <p className="text-xs font-medium" style={{ color: "#6366f1" }}>
                          Your delivery · stop {routeIdx}
                        </p>
                        {legMinHere !== null && (
                          <p className="text-xs text-muted-foreground">
                            ~{legMinHere} min from previous stop
                          </p>
                        )}
                      </>
                    )}
                    {isAvailable && (
                      <>
                        <p className="text-xs font-medium" style={{ color: "#ca8a04" }}>
                          Available to accept
                        </p>
                        {travelFromR[code] != null && (
                          <p className="text-xs text-muted-foreground">
                            ~{travelFromR[code]} min from restaurant
                          </p>
                        )}
                      </>
                    )}
                    {!isRestaurant && !isAccepted && !isAvailable && (
                      <p className="text-xs text-slate-400">No active order</p>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* Status + legend row */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground px-0.5">
        {osrmLoading && (
          <span className="text-indigo-500 font-medium animate-pulse">Loading real route…</span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-orange-500 shrink-0" />
          Restaurant (start)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-indigo-500 shrink-0" />
          Your deliveries
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-yellow-400 shrink-0" />
          Available to accept
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-slate-400 shrink-0" />
          No active order
        </span>
        {routePositions.length > 1 && (
          <span className="flex items-center gap-1.5 text-indigo-500 font-medium">
            <span className="w-4 border-t-2 border-indigo-500 shrink-0" />
            {osrm ? "Real road route · OSRM" : "Route (loading…)"}
          </span>
        )}
      </div>
    </div>
  );
}
