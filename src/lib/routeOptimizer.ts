// Nearest-neighbor optimization over predefined travel times.
// Locations are coded: 'R' for restaurant, 'C1'..'C8' for customers.

export interface TravelEdge {
  from_location: string;
  to_location: string;
  travel_minutes: number;
}

export interface OptimizedStop {
  code: string;
  label: string;
  travelFromPrev: number;
}

export interface OptimizedRoute {
  stops: OptimizedStop[];
  totalMinutes: number;
}

export function buildTravelMatrix(edges: TravelEdge[]): Map<string, Map<string, number>> {
  const m = new Map<string, Map<string, number>>();
  for (const e of edges) {
    if (!m.has(e.from_location)) m.set(e.from_location, new Map());
    m.get(e.from_location)!.set(e.to_location, e.travel_minutes);
  }
  return m;
}

export function optimizeRoute(
  customerCodes: string[],
  labels: Record<string, string>,
  edges: TravelEdge[],
): OptimizedRoute {
  const matrix = buildTravelMatrix(edges);
  const remaining = new Set(customerCodes);
  const stops: OptimizedStop[] = [{ code: "R", label: labels["R"] ?? "Restaurant", travelFromPrev: 0 }];
  let current = "R";
  let total = 0;
  while (remaining.size > 0) {
    let best: { code: string; mins: number } | null = null;
    for (const code of remaining) {
      const mins = matrix.get(current)?.get(code) ?? Number.POSITIVE_INFINITY;
      if (best === null || mins < best.mins) best = { code, mins };
    }
    if (!best) break;
    total += best.mins;
    stops.push({
      code: best.code,
      label: labels[best.code] ?? best.code,
      travelFromPrev: best.mins,
    });
    remaining.delete(best.code);
    current = best.code;
  }
  return { stops, totalMinutes: total };
}
