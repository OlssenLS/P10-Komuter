import { Injectable, Logger } from '@nestjs/common';
import {
  Station,
  StationLiveStatus,
  ReportCategory,
  ReportSubCategory,
} from '@prisma/client';
import { TRANSIT_TRACKS, TransitTrack } from '../stations/transit-tracks.js';

export type FeedCardType =
  | 'SINGLE_STATION'
  | 'CORRIDOR_EVENT'
  | 'MULTI_LINE_EVENT'
  | 'MASSIVE_DELAY_EVENT';

export interface MergedFeedCard {
  id: string;
  type: FeedCardType;
  primarySubCategory: string;
  title: string;
  headline: string; // compatibility
  category: ReportCategory;
  subCategory: string; // compatibility
  stationId: string; // compatibility: anchor station
  stationName: string; // compatibility: anchor station name
  affectedStationIds: string[];
  affectedStationNames: string[];
  affectedLines: string[];
  totalReports: number;
  reportCount: number; // compatibility
  isSkippedOrClosed: boolean;
  downstreamImpact: string | null;
  crowdImpact: string | null;
  topNote: string | null; // compatibility
  topNotes: string[];
  status: 'ACTIVE';
  startedAt?: string;
  expiresAt?: string;
  updatedAt: Date;
}

export interface GraphEdge {
  targetId: string;
  targetName: string;
  edgeType: 'LINE' | 'TRANSFER';
  lineName?: string;
  distanceMeters?: number;
}

export const CAUSAL_PRIORITY: Record<string, number> = {
  FIRE_SMOKE: 100,
  FLOOD_WEATHER: 90,
  TRACK_INCIDENT: 80,
  PROTEST_DEMONSTRATION: 70,
  MEDICAL_SECURITY: 60,
  POWER_SIGNAL_FAILURE: 50,
  POWER_SIGNAL: 50, // alias for prisma enum
  ROUTE_DIVERSION: 40,
  STATION_CLOSED: 30,
  OTHER: 10,
};

export const ROOT_CAUSES = new Set([
  'FIRE_SMOKE',
  'FLOOD_WEATHER',
  'TRACK_INCIDENT',
  'PROTEST_DEMONSTRATION',
  'MEDICAL_SECURITY',
  'POWER_SIGNAL_FAILURE',
  'POWER_SIGNAL',
]);

export const GENERIC_SYMPTOMS = new Set([
  'ROUTE_DIVERSION',
  'STATION_CLOSED',
]);

export const RAIL_INFRASTRUCTURE_CAUSES = new Set([
  'TRACK_INCIDENT',
  'POWER_SIGNAL_FAILURE',
  'POWER_SIGNAL',
  'ROUTE_DIVERSION',
]);

export const CROSS_MODAL_ENVIRONMENTAL_CAUSES = new Set([
  'FLOOD_WEATHER',
  'FIRE_SMOKE',
  'PROTEST_DEMONSTRATION',
  'MEDICAL_SECURITY',
]);

export const CAUSE_LABELS: Record<string, string> = {
  FIRE_SMOKE: 'Kebakaran / Asap',
  FLOOD_WEATHER: 'Banjir / Cuaca Ekstrem',
  TRACK_INCIDENT: 'Kendala Jalur Rel',
  PROTEST_DEMONSTRATION: 'Aksi Demonstrasi / Massa',
  MEDICAL_SECURITY: 'Darurat Medis / Keamanan',
  POWER_SIGNAL_FAILURE: 'Gangguan Listrik / Sinyal',
  POWER_SIGNAL: 'Gangguan Listrik / Sinyal',
  ROUTE_DIVERSION: 'Pengalihan Rute',
  STATION_CLOSED: 'Stasiun Ditutup Sementara',
  OTHER: 'Kendala Operasional',
  MAJOR: 'Keterlambatan Massal',
  MAJOR_DELAY: 'Keterlambatan Massal',
};

export function getCauseLabel(subCategory: string): string {
  return CAUSE_LABELS[subCategory] || subCategory.replace(/_/g, ' ');
}

export function calculateHaversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function deduplicateNotes(notes: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const n of notes) {
    if (!n || !n.trim()) continue;
    const clean = n.trim();
    const lower = clean.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(clean);
    }
  }
  return result.slice(0, 3);
}

interface ActiveDisruptionNode {
  stationId: string;
  stationName: string;
  station: Station;
  subCategory: string;
  reportCount: number;
  isSkippedOrClosed: boolean;
  topNotes: string[];
  affectedLineIds: string[];
  startedAt?: string;
  expiresAt: string;
  updatedAt: Date;
}

@Injectable()
export class EventMergingService {
  private readonly logger = new Logger(EventMergingService.name);

  /**
   * 1. Build the Combined Transit Adjacency Graph G = (V, E_line ∪ E_transfer)
   */
  buildTopologyGraph(stations: Station[]): {
    adjacency: Map<string, GraphEdge[]>;
    stationById: Map<string, Station>;
    stationByName: Map<string, Station>;
    stationLineIndices: Map<string, Map<string, number>>;
  } {
    const adjacency = new Map<string, GraphEdge[]>();
    const stationById = new Map<string, Station>();
    const stationByName = new Map<string, Station>();
    const stationLineIndices = new Map<string, Map<string, number>>();

    for (const s of stations) {
      stationById.set(s.id, s);
      stationByName.set(s.name.trim().toLowerCase(), s);
      adjacency.set(s.id, []);
    }

    const addEdge = (
      fromId: string,
      toId: string,
      edgeType: 'LINE' | 'TRANSFER',
      lineName?: string,
      distanceMeters?: number,
    ) => {
      const fromEdges = adjacency.get(fromId) || [];
      const toStation = stationById.get(toId);
      if (!toStation) return;

      const alreadyExists = fromEdges.some(
        (e) => e.targetId === toId && e.edgeType === edgeType && e.lineName === lineName,
      );
      if (!alreadyExists) {
        fromEdges.push({
          targetId: toId,
          targetName: toStation.name,
          edgeType,
          lineName,
          distanceMeters,
        });
        adjacency.set(fromId, fromEdges);
      }
    };

    // 1a. Build E_line (consecutive stations along seeded route order)
    for (const track of TRANSIT_TRACKS) {
      const lineMap = new Map<string, number>();
      track.stationNames.forEach((name, idx) => {
        lineMap.set(name.trim().toLowerCase(), idx);
      });
      stationLineIndices.set(track.line, lineMap);

      for (let i = 0; i < track.stationNames.length - 1; i++) {
        const nameA = track.stationNames[i].trim().toLowerCase();
        const nameB = track.stationNames[i + 1].trim().toLowerCase();
        const stA = stationByName.get(nameA);
        const stB = stationByName.get(nameB);

        if (stA && stB && stA.id !== stB.id) {
          addEdge(stA.id, stB.id, 'LINE', track.line);
          addEdge(stB.id, stA.id, 'LINE', track.line);
        }
      }
    }

    // 1b. Build E_transfer (Micro-interchanges <= 400m physical walking transfers on different lines)
    const stationLineTracksMap = new Map<string, Set<string>>();
    for (const track of TRANSIT_TRACKS) {
      for (const name of track.stationNames) {
        const key = name.trim().toLowerCase();
        if (!stationLineTracksMap.has(key)) {
          stationLineTracksMap.set(key, new Set());
        }
        stationLineTracksMap.get(key)!.add(track.line);
      }
    }

    for (let i = 0; i < stations.length; i++) {
      for (let j = i + 1; j < stations.length; j++) {
        const u = stations[i];
        const v = stations[j];

        // Stations must not share any line track (transfers are strictly cross-line interchanges)
        const uLines =
          stationLineTracksMap.get(u.name.trim().toLowerCase()) ||
          new Set(u.lineNames || []);
        const vLines =
          stationLineTracksMap.get(v.name.trim().toLowerCase()) ||
          new Set(v.lineNames || []);

        let sharesAnyLine = false;
        for (const line of uLines) {
          if (vLines.has(line)) {
            sharesAnyLine = true;
            break;
          }
        }

        if (sharesAnyLine) {
          // Stations on the same line corridor must never be linked via E_transfer
          continue;
        }

        const dist = calculateHaversineMeters(
          u.latitude,
          u.longitude,
          v.latitude,
          v.longitude,
        );

        if (dist <= 400) {
          addEdge(u.id, v.id, 'TRANSFER', undefined, dist);
          addEdge(v.id, u.id, 'TRANSFER', undefined, dist);
        }
      }
    }

    return { adjacency, stationById, stationByName, stationLineIndices };
  }

  /**
   * 3-Pass Synthesis Pipeline:
   * Pass 1: Active Disruption Graph Clustering (BFS over E_line ∪ E_transfer)
   * Pass 2: Standalone Massive Corridor Delay (MASSIVE_DELAY_EVENT >= 3 contiguous stations)
   * Pass 3: Sort & Return by Severity Weight, Total Reports desc, and UpdatedAt desc
   */
  synthesizeFeed(
    allStations: Station[],
    liveStatuses: (StationLiveStatus & { station?: Station })[],
    now: Date = new Date(),
  ): MergedFeedCard[] {
    const { adjacency, stationById, stationByName, stationLineIndices } =
      this.buildTopologyGraph(allStations);

    const liveStatusByStationId = new Map<string, StationLiveStatus>();
    for (const ls of liveStatuses) {
      liveStatusByStationId.set(ls.stationId, ls);
    }

    // --- Pass 1: Active Disruption Graph Clustering ---
    const activeNodes = new Map<string, ActiveDisruptionNode>();

    for (const ls of liveStatuses) {
      const station = ls.station || stationById.get(ls.stationId);
      if (!station) continue;

      const disruptionState = (ls.disruptionState as Record<string, any>) || {};
      const activeEntries: { subCategory: string; entry: any }[] = [];

      for (const [subCat, entry] of Object.entries(disruptionState)) {
        if (
          entry &&
          entry.status === 'ACTIVE' &&
          entry.expiresAt &&
          new Date(entry.expiresAt) > now
        ) {
          activeEntries.push({ subCategory: subCat, entry });
        }
      }

      if (activeEntries.length > 0) {
        // Pick entry with highest specificity priority
        activeEntries.sort(
          (a, b) =>
            (CAUSAL_PRIORITY[b.subCategory] || 0) -
            (CAUSAL_PRIORITY[a.subCategory] || 0),
        );

        const chosen = activeEntries[0];
        const topNotes = Array.isArray(chosen.entry.topNotes)
          ? chosen.entry.topNotes
          : chosen.entry.topNote
            ? [chosen.entry.topNote]
            : [];

        activeNodes.set(station.id, {
          stationId: station.id,
          stationName: station.name,
          station,
          subCategory: chosen.subCategory,
          reportCount: Number(chosen.entry.reportCount) || 0,
          isSkippedOrClosed: Boolean(
            chosen.entry.isSkippedOrClosed ||
              chosen.subCategory === 'STATION_CLOSED',
          ),
          topNotes,
          affectedLineIds: Array.isArray(chosen.entry.affectedLineIds)
            ? chosen.entry.affectedLineIds
            : station.lineNames || [],
          startedAt: chosen.entry.startedAt,
          expiresAt: chosen.entry.expiresAt,
          updatedAt: ls.updatedAt,
        });
      }
    }

    // BFS Clustering over active nodes
    const visited = new Set<string>();
    const clusters: ActiveDisruptionNode[][] = [];

    for (const [stationId, startNode] of activeNodes.entries()) {
      if (visited.has(stationId)) continue;

      const cluster: ActiveDisruptionNode[] = [];
      const queue: string[] = [stationId];
      visited.add(stationId);

      let clusterRootCause: string | null = ROOT_CAUSES.has(startNode.subCategory)
        ? startNode.subCategory
        : null;

      while (queue.length > 0) {
        const currId = queue.shift()!;
        const currNode = activeNodes.get(currId)!;
        cluster.push(currNode);

        const edges = adjacency.get(currId) || [];
        for (const edge of edges) {
          const nbrId = edge.targetId;
          // Must only traverse to ACTIVE disruption nodes.
          // Never bridges across unreported or healthy intermediate stations (status !== 'ACTIVE').
          if (visited.has(nbrId) || !activeNodes.has(nbrId)) continue;

          const nbrNode = activeNodes.get(nbrId)!;

          // Rail-specific infrastructure causes (TRACK_INCIDENT, POWER_SIGNAL_FAILURE, ROUTE_DIVERSION)
          // must ONLY traverse E_line edges (same rail network/corridor) and must never bridge across
          // E_transfer walkways onto a separate transit system.
          if (edge.edgeType === 'TRANSFER') {
            const isCurrRailInfra = RAIL_INFRASTRUCTURE_CAUSES.has(currNode.subCategory);
            const isNbrRailInfra = RAIL_INFRASTRUCTURE_CAUSES.has(nbrNode.subCategory);
            const isClusterRailInfra = Boolean(
              clusterRootCause && RAIL_INFRASTRUCTURE_CAUSES.has(clusterRootCause),
            );

            // If either node or cluster root cause is rail-specific infrastructure, do NOT traverse E_transfer!
            if (isCurrRailInfra || isNbrRailInfra || isClusterRailInfra) {
              continue;
            }

            // Cross-modal / environmental causes (FLOOD_WEATHER, FIRE_SMOKE, PROTEST_DEMONSTRATION, MEDICAL_SECURITY)
            // may continue traversing E_transfer edges
            const hasCrossModalCause =
              CROSS_MODAL_ENVIRONMENTAL_CAUSES.has(currNode.subCategory) ||
              CROSS_MODAL_ENVIRONMENTAL_CAUSES.has(nbrNode.subCategory) ||
              Boolean(clusterRootCause && CROSS_MODAL_ENVIRONMENTAL_CAUSES.has(clusterRootCause));

            if (!hasCrossModalCause) {
              continue;
            }
          }

          // Merge compatibility:
          // 1. Same subCategory merges
          // 2. Generic symptom merges with root cause
          // 3. Two generic symptoms merge
          // 4. Do NOT merge two DIFFERENT root causes
          let canMerge = false;
          if (currNode.subCategory === nbrNode.subCategory) {
            canMerge = true;
          } else if (
            (GENERIC_SYMPTOMS.has(currNode.subCategory) &&
              ROOT_CAUSES.has(nbrNode.subCategory)) ||
            (ROOT_CAUSES.has(currNode.subCategory) &&
              GENERIC_SYMPTOMS.has(nbrNode.subCategory)) ||
            (GENERIC_SYMPTOMS.has(currNode.subCategory) &&
              GENERIC_SYMPTOMS.has(nbrNode.subCategory))
          ) {
            if (clusterRootCause) {
              if (
                GENERIC_SYMPTOMS.has(nbrNode.subCategory) ||
                nbrNode.subCategory === clusterRootCause
              ) {
                canMerge = true;
              }
            } else {
              canMerge = true;
            }
          }

          if (canMerge) {
            visited.add(nbrId);
            if (!clusterRootCause && ROOT_CAUSES.has(nbrNode.subCategory)) {
              clusterRootCause = nbrNode.subCategory;
            }
            queue.push(nbrId);
          }
        }
      }

      clusters.push(cluster);
    }

    const disruptionCards: MergedFeedCard[] = [];
    const absorbedDelayStationIds = new Set<string>();

    for (const cluster of clusters) {
      // 1. Headline primarySubCategory via strict specificity priority
      const sortedByPriority = [...cluster].sort(
        (a, b) =>
          (CAUSAL_PRIORITY[b.subCategory] || 0) -
          (CAUSAL_PRIORITY[a.subCategory] || 0),
      );
      const headlineSubCategory = sortedByPriority[0].subCategory;
      const causeLabel = getCauseLabel(headlineSubCategory);

      // 2. Affected Lines: Find all transit lines touching stations in cluster
      const clusterStationNames = new Set(
        cluster.map((n) => n.stationName.trim().toLowerCase()),
      );
      const affectedLinesSet = new Set<string>();

      for (const track of TRANSIT_TRACKS) {
        if (
          track.stationNames.some((name) =>
            clusterStationNames.has(name.trim().toLowerCase()),
          )
        ) {
          affectedLinesSet.add(track.line);
        }
      }

      const affectedLines = Array.from(affectedLinesSet);

      // Aggregated metadata
      const affectedStationIds = cluster.map((n) => n.stationId);
      const affectedStationNames = cluster.map((n) => n.stationName);
      const totalReports = cluster.reduce((sum, n) => sum + n.reportCount, 0);
      const isSkippedOrClosed = cluster.some((n) => n.isSkippedOrClosed);
      const topNotes = deduplicateNotes(cluster.flatMap((n) => n.topNotes));
      const newestUpdatedAt = new Date(
        Math.max(...cluster.map((n) => new Date(n.updatedAt).getTime())),
      );

      // Classification & Deterministic Titles
      let type: FeedCardType;
      let title: string;

      if (cluster.length === 1) {
        type = 'SINGLE_STATION';
        title = `${causeLabel} di ${cluster[0].stationName}`;
      } else if (affectedLines.length === 1) {
        type = 'CORRIDOR_EVENT';
        const lineName = affectedLines[0];
        const lineIndices = stationLineIndices.get(lineName);

        const sortedAlongLine = [...cluster].sort((a, b) => {
          const idxA =
            lineIndices?.get(a.stationName.trim().toLowerCase()) ?? 999;
          const idxB =
            lineIndices?.get(b.stationName.trim().toLowerCase()) ?? 999;
          return idxA - idxB;
        });

        const startStation = sortedAlongLine[0].stationName;
        const endStation = sortedAlongLine[sortedAlongLine.length - 1].stationName;
        title = `${causeLabel}: ${startStation} – ${endStation} (${lineName})`;
      } else {
        type = 'MULTI_LINE_EVENT';
        // Anchor station: station having root cause or first station
        const anchorNode = sortedByPriority[0] || cluster[0];
        const lastNode = cluster[cluster.length - 1];
        title = `${causeLabel}: Area ${anchorNode.stationName} – ${lastNode.stationName} (${affectedLines.length} Lintas Terdampak)`;
      }

      // 2-Hop Downstream Delay & Crowd Absorption along Line Edges
      const downstreamDelayStationNames: string[] = [];
      const crowdStationNames: string[] = [];
      const clusterIdsSet = new Set(affectedStationIds);

      // Check crowd within cluster
      for (const node of cluster) {
        const ls = liveStatusByStationId.get(node.stationId);
        if (this.isStationCrowded(ls)) {
          crowdStationNames.push(node.stationName);
        }
      }

      // Walk up to 2 edges outward along LINE edges (E_line)
      const queue: { stationId: string; hop: number }[] = cluster.map((n) => ({
        stationId: n.stationId,
        hop: 0,
      }));
      const outwardVisited = new Set<string>(affectedStationIds);

      while (queue.length > 0) {
        const { stationId: currentId, hop } = queue.shift()!;
        if (hop >= 2) continue;

        const edges = adjacency.get(currentId) || [];
        for (const edge of edges) {
          if (edge.edgeType !== 'LINE') continue; // Only walk line edges
          const nbrId = edge.targetId;

          if (!outwardVisited.has(nbrId)) {
            outwardVisited.add(nbrId);
            const nbrStation = stationById.get(nbrId);
            const nbrLs = liveStatusByStationId.get(nbrId);

            // 1-hop crowd absorption
            if (hop === 0 && this.isStationCrowded(nbrLs) && nbrStation) {
              crowdStationNames.push(nbrStation.name);
            }

            // Up to 2-hop downstream delay absorption
            if (nbrStation && this.hasActiveMajorDelay(nbrLs, now)) {
              absorbedDelayStationIds.add(nbrId);
              downstreamDelayStationNames.push(nbrStation.name);
            }

            queue.push({ stationId: nbrId, hop: hop + 1 });
          }
        }
      }

      const downstreamImpact =
        downstreamDelayStationNames.length > 0
          ? `Keterlambatan berimbas hingga ${[...new Set(downstreamDelayStationNames)].join(', ')}`
          : null;

      const crowdImpact =
        crowdStationNames.length > 0
          ? `Kepadatan tinggi di ${[...new Set(crowdStationNames)].join(', ')}`
          : null;

      disruptionCards.push({
        id: `${type.toLowerCase()}-${cluster[0].stationId}-${headlineSubCategory.toLowerCase()}`,
        type,
        primarySubCategory: headlineSubCategory,
        title,
        headline: title,
        category: ReportCategory.DISRUPTION,
        subCategory: headlineSubCategory,
        stationId: cluster[0].stationId,
        stationName: cluster[0].stationName,
        affectedStationIds,
        affectedStationNames,
        affectedLines,
        totalReports,
        reportCount: totalReports,
        isSkippedOrClosed,
        downstreamImpact,
        crowdImpact,
        topNote: topNotes[0] || null,
        topNotes,
        status: 'ACTIVE',
        startedAt: cluster[0].startedAt,
        expiresAt: cluster[0].expiresAt,
        updatedAt: newestUpdatedAt,
      });
    }

    // --- Pass 2: Standalone Massive Corridor Delay (MASSIVE_DELAY_EVENT) ---
    // For remaining unabsorbed stations, check if >= 3 contiguous stations on the same lineName have MAJOR DELAY quorum active
    const clusterStationIds = new Set(clusters.flatMap((c) => c.map((n) => n.stationId)));
    const delayCards: MergedFeedCard[] = [];
    const handledPass2Stations = new Set<string>();

    for (const track of TRANSIT_TRACKS) {
      const lineName = track.line;
      let currentRun: Station[] = [];

      const flushRun = () => {
        if (currentRun.length >= 3) {
          const runStations = [...currentRun];
          runStations.forEach((s) => handledPass2Stations.add(s.id));

          const runStationIds = runStations.map((s) => s.id);
          const runStationNames = runStations.map((s) => s.name);
          const startStation = runStations[0].name;
          const endStation = runStations[runStations.length - 1].name;
          const title = `Keterlambatan Massal: ${startStation} – ${endStation} (${lineName})`;

          let totalReports = 0;
          const allNotes: string[] = [];
          const crowdNames: string[] = [];
          let maxUpdatedAt = new Date(0);

          for (const s of runStations) {
            const ls = liveStatusByStationId.get(s.id);
            if (ls) {
              if (new Date(ls.updatedAt) > maxUpdatedAt) {
                maxUpdatedAt = new Date(ls.updatedAt);
              }
              if (this.isStationCrowded(ls)) {
                crowdNames.push(s.name);
              }
              const delayState = (ls.delayState as Record<string, any>) || {};
              for (const entry of Object.values(delayState)) {
                if (
                  entry &&
                  Number(entry.majorCount) >= 3 &&
                  entry.expiresAt &&
                  new Date(entry.expiresAt) > now
                ) {
                  totalReports += Number(entry.majorCount) || 0;
                  if (Array.isArray(entry.topNotes)) {
                    allNotes.push(...entry.topNotes);
                  }
                }
              }
            }
          }

          const crowdImpact =
            crowdNames.length > 0
              ? `Kepadatan tinggi di ${[...new Set(crowdNames)].join(', ')}`
              : null;

          delayCards.push({
            id: `massive-delay-${runStations[0].id}-${lineName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
            type: 'MASSIVE_DELAY_EVENT',
            primarySubCategory: 'MAJOR',
            title,
            headline: title,
            category: ReportCategory.DELAY,
            subCategory: 'MAJOR',
            stationId: runStations[0].id,
            stationName: runStations[0].name,
            affectedStationIds: runStationIds,
            affectedStationNames: runStationNames,
            affectedLines: [lineName],
            totalReports,
            reportCount: totalReports,
            isSkippedOrClosed: false,
            downstreamImpact: null,
            crowdImpact,
            topNote: allNotes[0] || null,
            topNotes: deduplicateNotes(allNotes),
            status: 'ACTIVE',
            updatedAt: maxUpdatedAt.getTime() > 0 ? maxUpdatedAt : now,
          });
        }
        currentRun = [];
      };

      for (const stationName of track.stationNames) {
        const s = stationByName.get(stationName.trim().toLowerCase());
        if (!s) {
          flushRun();
          continue;
        }

        const isDisrupted = clusterStationIds.has(s.id);
        const isAbsorbed = absorbedDelayStationIds.has(s.id);
        const isAlreadyHandled = handledPass2Stations.has(s.id);
        const ls = liveStatusByStationId.get(s.id);
        const hasMajorDelay =
          !isDisrupted &&
          !isAbsorbed &&
          !isAlreadyHandled &&
          this.hasActiveMajorDelayOnLine(ls, lineName, now);

        if (hasMajorDelay) {
          currentRun.push(s);
        } else {
          flushRun();
        }
      }
      flushRun();
    }

    // --- Pass 3: Sort & Return ---
    // Sort final feed cards by severity (MULTI_LINE_EVENT / CORRIDOR_EVENT / SINGLE_STATION disruptions first, then MASSIVE_DELAY_EVENT, ordered by totalReports and updatedAt desc).
    const SEVERITY_WEIGHT: Record<FeedCardType, number> = {
      MULTI_LINE_EVENT: 400,
      CORRIDOR_EVENT: 300,
      SINGLE_STATION: 200,
      MASSIVE_DELAY_EVENT: 100,
    };

    const combinedCards = [...disruptionCards, ...delayCards];

    combinedCards.sort((a, b) => {
      const weightA = SEVERITY_WEIGHT[a.type] || 0;
      const weightB = SEVERITY_WEIGHT[b.type] || 0;
      if (weightA !== weightB) {
        return weightB - weightA; // High severity first
      }
      if (b.totalReports !== a.totalReports) {
        return b.totalReports - a.totalReports; // More reports first
      }
      return (
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    });

    return combinedCards;
  }

  private hasActiveMajorDelay(ls: StationLiveStatus | undefined, now: Date): boolean {
    if (!ls) return false;
    const delayState = (ls.delayState as Record<string, any>) || {};
    for (const entry of Object.values(delayState)) {
      if (
        entry &&
        Number(entry.majorCount) >= 3 &&
        entry.expiresAt &&
        new Date(entry.expiresAt) > now
      ) {
        return true;
      }
    }
    return false;
  }

  private hasActiveMajorDelayOnLine(
    ls: StationLiveStatus | undefined,
    lineName: string,
    now: Date,
  ): boolean {
    if (!ls) return false;
    const delayState = (ls.delayState as Record<string, any>) || {};
    for (const [key, entry] of Object.entries(delayState)) {
      if (
        entry &&
        Number(entry.majorCount) >= 3 &&
        entry.expiresAt &&
        new Date(entry.expiresAt) > now
      ) {
        const matchesLine =
          entry.lineName === lineName ||
          entry.lineId === lineName ||
          key.startsWith(`${lineName}:`) ||
          !entry.lineName; // fallback matches
        if (matchesLine) {
          return true;
        }
      }
    }
    return false;
  }

  private isStationCrowded(ls: StationLiveStatus | undefined): boolean {
    if (!ls) return false;
    const crowdState = (ls.crowdState as Record<string, any>) || {};
    const high = Number(crowdState.high) || 0;
    const veryHigh = Number(crowdState.very_high) || 0;
    return high + veryHigh >= 1;
  }
}
