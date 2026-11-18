import { describe, it, expect, beforeEach } from 'vitest';
import {
  EventMergingService,
  calculateHaversineMeters,
  CAUSAL_PRIORITY,
} from './event-merging.service.js';
import { Station, StationLiveStatus, TransportType } from '@prisma/client';

describe('EventMergingService', () => {
  let service: EventMergingService;

  beforeEach(() => {
    service = new EventMergingService();
  });

  describe('Haversine & Topology Graph', () => {
    it('should correctly calculate distance between coordinates', () => {
      // Sudirman (-6.2024, 106.8236) to BNI City (-6.2017, 106.8214) ~255m
      const dist = calculateHaversineMeters(-6.2024, 106.8236, -6.2017, 106.8214);
      expect(dist).toBeGreaterThan(200);
      expect(dist).toBeLessThan(350);
    });

    it('should create transfer edges only for pairs <= 400m', () => {
      const mockStations: Station[] = [
        {
          id: 'st-sudirman',
          name: 'Stasiun Sudirman',
          isTransitHub: true,
          supportedTypes: [TransportType.KRL],
          lineNames: ['Cikarang Line'],
          latitude: -6.2024,
          longitude: 106.8236,
          validDestinations: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'st-dukuh-atas',
          name: 'Stasiun MRT Dukuh Atas BNI',
          isTransitHub: true,
          supportedTypes: [TransportType.MRT],
          lineNames: ['North South Line (MRT)'],
          latitude: -6.2008,
          longitude: 106.8228,
          validDestinations: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'st-bogor',
          name: 'Stasiun Bogor',
          isTransitHub: false,
          supportedTypes: [TransportType.KRL],
          lineNames: ['Bogor Line'],
          latitude: -6.5976,
          longitude: 106.7894,
          validDestinations: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const { adjacency } = service.buildTopologyGraph(mockStations);
      const sudirmanEdges = adjacency.get('st-sudirman') || [];

      // Sudirman to Dukuh Atas is ~200m -> TRANSFER edge should exist
      const toDukuhAtas = sudirmanEdges.find((e) => e.targetId === 'st-dukuh-atas');
      expect(toDukuhAtas).toBeDefined();
      expect(toDukuhAtas?.edgeType).toBe('TRANSFER');

      // Sudirman to Bogor is ~45km -> TRANSFER edge must NOT exist
      const toBogor = sudirmanEdges.find((e) => e.targetId === 'st-bogor');
      expect(toBogor).toBeUndefined();
    });
  });

  describe('Causal Specificity Priority & Headline Determination', () => {
    it('should prioritize FIRE_SMOKE over FLOOD_WEATHER and TRACK_INCIDENT', () => {
      expect(CAUSAL_PRIORITY['FIRE_SMOKE']).toBeGreaterThan(CAUSAL_PRIORITY['FLOOD_WEATHER']);
      expect(CAUSAL_PRIORITY['FLOOD_WEATHER']).toBeGreaterThan(CAUSAL_PRIORITY['TRACK_INCIDENT']);
      expect(CAUSAL_PRIORITY['TRACK_INCIDENT']).toBeGreaterThan(CAUSAL_PRIORITY['STATION_CLOSED']);
    });

    it('should synthesize SINGLE_STATION when only 1 station has disruption', () => {
      const now = new Date();
      const expires = new Date(now.getTime() + 60 * 60 * 1000).toISOString();

      const stations: Station[] = [
        {
          id: 'st-tebet',
          name: 'Stasiun Tebet',
          isTransitHub: false,
          supportedTypes: [TransportType.KRL],
          lineNames: ['Bogor Line'],
          latitude: -6.2263,
          longitude: 106.8582,
          validDestinations: [],
          createdAt: now,
          updatedAt: now,
        },
      ];

      const liveStatuses: (StationLiveStatus & { station?: Station })[] = [
        {
          id: 'ls-tebet',
          stationId: 'st-tebet',
          station: stations[0],
          crowdState: {},
          delayState: {},
          facilityState: {},
          disruptionState: {
            FLOOD_WEATHER: {
              status: 'ACTIVE',
              reportCount: 4,
              expiresAt: expires,
              topNotes: ['Banjir di underpass'],
            },
          },
          createdAt: now,
          updatedAt: now,
        },
      ];

      const feed = service.synthesizeFeed(stations, liveStatuses, now);
      expect(feed.length).toBe(1);
      expect(feed[0].type).toBe('SINGLE_STATION');
      expect(feed[0].primarySubCategory).toBe('FLOOD_WEATHER');
      expect(feed[0].title).toBe('Banjir / Cuaca Ekstrem di Stasiun Tebet');
      expect(feed[0].totalReports).toBe(4);
      expect(feed[0].topNotes).toEqual(['Banjir di underpass']);
    });

    it('should synthesize CORRIDOR_EVENT and absorb STATION_CLOSED under TRACK_INCIDENT root cause', () => {
      const now = new Date();
      const expires = new Date(now.getTime() + 60 * 60 * 1000).toISOString();

      // Consecutive stations on Cikarang Line: Cakung, Klender Baru, Buaran
      const stations: Station[] = [
        {
          id: 'st-cakung',
          name: 'Stasiun Cakung',
          isTransitHub: false,
          supportedTypes: [TransportType.KRL],
          lineNames: ['Cikarang Line'],
          latitude: -6.2185,
          longitude: 106.9531,
          validDestinations: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'st-klender-baru',
          name: 'Stasiun Klender Baru',
          isTransitHub: false,
          supportedTypes: [TransportType.KRL],
          lineNames: ['Cikarang Line'],
          latitude: -6.2182,
          longitude: 106.9388,
          validDestinations: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'st-buaran',
          name: 'Stasiun Buaran',
          isTransitHub: false,
          supportedTypes: [TransportType.KRL],
          lineNames: ['Cikarang Line'],
          latitude: -6.2166,
          longitude: 106.9189,
          validDestinations: [],
          createdAt: now,
          updatedAt: now,
        },
      ];

      const liveStatuses: (StationLiveStatus & { station?: Station })[] = [
        {
          id: 'ls-cakung',
          stationId: 'st-cakung',
          station: stations[0],
          crowdState: {},
          delayState: {},
          facilityState: {},
          disruptionState: {
            STATION_CLOSED: {
              status: 'ACTIVE',
              reportCount: 3,
              expiresAt: expires,
              isSkippedOrClosed: true,
              topNotes: ['Stasiun ditutup'],
            },
          },
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'ls-klender-baru',
          stationId: 'st-klender-baru',
          station: stations[1],
          crowdState: {},
          delayState: {},
          facilityState: {},
          disruptionState: {
            TRACK_INCIDENT: {
              status: 'ACTIVE',
              reportCount: 8,
              expiresAt: expires,
              topNotes: ['Rel patah'],
            },
          },
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'ls-buaran',
          stationId: 'st-buaran',
          station: stations[2],
          crowdState: {},
          delayState: {},
          facilityState: {},
          disruptionState: {
            STATION_CLOSED: {
              status: 'ACTIVE',
              reportCount: 2,
              expiresAt: expires,
              isSkippedOrClosed: true,
              topNotes: ['Kereta tidak berhenti'],
            },
          },
          createdAt: now,
          updatedAt: now,
        },
      ];

      const feed = service.synthesizeFeed(stations, liveStatuses, now);
      expect(feed.length).toBe(1);
      expect(feed[0].type).toBe('CORRIDOR_EVENT');
      expect(feed[0].primarySubCategory).toBe('TRACK_INCIDENT');
      expect(feed[0].title).toContain('Kendala Jalur Rel:');
      expect(feed[0].title).toContain('Cikarang Line');
      expect(feed[0].affectedStationIds).toHaveLength(3);
      expect(feed[0].totalReports).toBe(13);
      expect(feed[0].isSkippedOrClosed).toBe(true);
    });

    it('should synthesize MULTI_LINE_EVENT when disruption connects across micro-interchanges', () => {
      const now = new Date();
      const expires = new Date(now.getTime() + 60 * 60 * 1000).toISOString();

      // Sudirman (Cikarang Line) and Dukuh Atas BNI (MRT) are <400m
      const stations: Station[] = [
        {
          id: 'st-sudirman',
          name: 'Stasiun Sudirman',
          isTransitHub: true,
          supportedTypes: [TransportType.KRL],
          lineNames: ['Cikarang Line'],
          latitude: -6.2024,
          longitude: 106.8236,
          validDestinations: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'st-dukuh-atas',
          name: 'Stasiun MRT Dukuh Atas BNI',
          isTransitHub: true,
          supportedTypes: [TransportType.MRT],
          lineNames: ['North South Line (MRT)'],
          latitude: -6.2008,
          longitude: 106.8228,
          validDestinations: [],
          createdAt: now,
          updatedAt: now,
        },
      ];

      const liveStatuses: (StationLiveStatus & { station?: Station })[] = [
        {
          id: 'ls-sudirman',
          stationId: 'st-sudirman',
          station: stations[0],
          crowdState: {},
          delayState: {},
          facilityState: {},
          disruptionState: {
            POWER_SIGNAL: {
              status: 'ACTIVE',
              reportCount: 6,
              expiresAt: expires,
              topNotes: ['Mati listrik'],
            },
          },
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'ls-dukuh-atas',
          stationId: 'st-dukuh-atas',
          station: stations[1],
          crowdState: {},
          delayState: {},
          facilityState: {},
          disruptionState: {
            STATION_CLOSED: {
              status: 'ACTIVE',
              reportCount: 4,
              expiresAt: expires,
              isSkippedOrClosed: true,
              topNotes: ['Pintu masuk ditutup'],
            },
          },
          createdAt: now,
          updatedAt: now,
        },
      ];

      const feed = service.synthesizeFeed(stations, liveStatuses, now);
      expect(feed.length).toBe(1);
      expect(feed[0].type).toBe('MULTI_LINE_EVENT');
      expect(feed[0].primarySubCategory).toBe('POWER_SIGNAL');
      expect(feed[0].title).toContain('Lintas Terdampak');
      expect(feed[0].affectedLines.length).toBeGreaterThanOrEqual(2);
      expect(feed[0].totalReports).toBe(10);
    });
  });

  describe('2-Hop Downstream Delay & Crowd Absorption', () => {
    it('should absorb 2-hop downstream MAJOR delays and attach downstreamImpact', () => {
      const now = new Date();
      const expires = new Date(now.getTime() + 60 * 60 * 1000).toISOString();

      const stations: Station[] = [
        {
          id: 'st-juanda',
          name: 'Stasiun Juanda',
          isTransitHub: false,
          supportedTypes: [TransportType.KRL],
          lineNames: ['Bogor Line'],
          latitude: -6.1666,
          longitude: 106.8306,
          validDestinations: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'st-gondangdia',
          name: 'Stasiun Gondangdia',
          isTransitHub: false,
          supportedTypes: [TransportType.KRL],
          lineNames: ['Bogor Line'],
          latitude: -6.1861,
          longitude: 106.8327,
          validDestinations: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'st-cikini',
          name: 'Stasiun Cikini',
          isTransitHub: false,
          supportedTypes: [TransportType.KRL],
          lineNames: ['Bogor Line'],
          latitude: -6.1985,
          longitude: 106.8415,
          validDestinations: [],
          createdAt: now,
          updatedAt: now,
        },
      ];

      const liveStatuses: (StationLiveStatus & { station?: Station })[] = [
        {
          id: 'ls-juanda',
          stationId: 'st-juanda',
          station: stations[0],
          crowdState: {},
          delayState: {},
          facilityState: {},
          disruptionState: {
            TRACK_INCIDENT: {
              status: 'ACTIVE',
              reportCount: 5,
              expiresAt: expires,
            },
          },
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'ls-gondangdia',
          stationId: 'st-gondangdia',
          station: stations[1],
          crowdState: { high: 2 },
          delayState: {
            'Bogor Line:st-bogor': {
              majorCount: 4,
              expiresAt: expires,
            },
          },
          facilityState: {},
          disruptionState: {},
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'ls-cikini',
          stationId: 'st-cikini',
          station: stations[2],
          crowdState: {},
          delayState: {
            'Bogor Line:st-bogor': {
              majorCount: 3,
              expiresAt: expires,
            },
          },
          facilityState: {},
          disruptionState: {},
          createdAt: now,
          updatedAt: now,
        },
      ];

      const feed = service.synthesizeFeed(stations, liveStatuses, now);
      expect(feed.length).toBe(1);
      expect(feed[0].type).toBe('SINGLE_STATION');
      expect(feed[0].downstreamImpact).toContain('Keterlambatan berimbas hingga');
      expect(feed[0].downstreamImpact).toContain('Stasiun Gondangdia');
      expect(feed[0].downstreamImpact).toContain('Stasiun Cikini');
      expect(feed[0].crowdImpact).toContain('Kepadatan tinggi di Stasiun Gondangdia');
    });
  });

  describe('Pass 2: Standalone Massive Corridor Delay', () => {
    it('should synthesize MASSIVE_DELAY_EVENT when >= 3 contiguous stations have MAJOR delay quorum', () => {
      const now = new Date();
      const expires = new Date(now.getTime() + 60 * 60 * 1000).toISOString();

      const stations: Station[] = [
        {
          id: 'st-duri',
          name: 'Stasiun Duri',
          isTransitHub: true,
          supportedTypes: [TransportType.KRL],
          lineNames: ['Tangerang Line'],
          latitude: -6.1554,
          longitude: 106.8016,
          validDestinations: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'st-grogol',
          name: 'Stasiun Grogol',
          isTransitHub: false,
          supportedTypes: [TransportType.KRL],
          lineNames: ['Tangerang Line'],
          latitude: -6.1608,
          longitude: 106.7891,
          validDestinations: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'st-pesing',
          name: 'Stasiun Pesing',
          isTransitHub: false,
          supportedTypes: [TransportType.KRL],
          lineNames: ['Tangerang Line'],
          latitude: -6.1582,
          longitude: 106.7725,
          validDestinations: [],
          createdAt: now,
          updatedAt: now,
        },
      ];

      const liveStatuses: (StationLiveStatus & { station?: Station })[] = [
        {
          id: 'ls-duri',
          stationId: 'st-duri',
          station: stations[0],
          crowdState: { high: 3 },
          delayState: {
            'Tangerang Line:st-tangerang': {
              lineName: 'Tangerang Line',
              majorCount: 5,
              expiresAt: expires,
              topNotes: ['Antrian sinyal Duri'],
            },
          },
          facilityState: {},
          disruptionState: {},
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'ls-grogol',
          stationId: 'st-grogol',
          station: stations[1],
          crowdState: {},
          delayState: {
            'Tangerang Line:st-tangerang': {
              lineName: 'Tangerang Line',
              majorCount: 3,
              expiresAt: expires,
            },
          },
          facilityState: {},
          disruptionState: {},
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'ls-pesing',
          stationId: 'st-pesing',
          station: stations[2],
          crowdState: {},
          delayState: {
            'Tangerang Line:st-tangerang': {
              lineName: 'Tangerang Line',
              majorCount: 4,
              expiresAt: expires,
            },
          },
          facilityState: {},
          disruptionState: {},
          createdAt: now,
          updatedAt: now,
        },
      ];

      const feed = service.synthesizeFeed(stations, liveStatuses, now);
      expect(feed.length).toBe(1);
      expect(feed[0].type).toBe('MASSIVE_DELAY_EVENT');
      expect(feed[0].title).toBe('Keterlambatan Massal: Stasiun Duri – Stasiun Pesing (Tangerang Line)');
      expect(feed[0].totalReports).toBe(12);
      expect(feed[0].crowdImpact).toContain('Stasiun Duri');
    });
  });

  describe('Pass 3: Severity Weight Sorting', () => {
    it('should sort cards: MULTI_LINE_EVENT > CORRIDOR_EVENT > SINGLE_STATION > MASSIVE_DELAY_EVENT', () => {
      const now = new Date();
      const expires = new Date(now.getTime() + 60 * 60 * 1000).toISOString();

      const stations: Station[] = [
        {
          id: 's-single',
          name: 'Stasiun Ancol',
          isTransitHub: false,
          supportedTypes: [TransportType.KRL],
          lineNames: ['Tanjung Priok Line'],
          latitude: -6.128,
          longitude: 106.845,
          validDestinations: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 's-tng1',
          name: 'Stasiun Duri',
          isTransitHub: true,
          supportedTypes: [TransportType.KRL],
          lineNames: ['Tangerang Line'],
          latitude: -6.1554,
          longitude: 106.8016,
          validDestinations: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 's-tng2',
          name: 'Stasiun Grogol',
          isTransitHub: false,
          supportedTypes: [TransportType.KRL],
          lineNames: ['Tangerang Line'],
          latitude: -6.1608,
          longitude: 106.7891,
          validDestinations: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 's-tng3',
          name: 'Stasiun Pesing',
          isTransitHub: false,
          supportedTypes: [TransportType.KRL],
          lineNames: ['Tangerang Line'],
          latitude: -6.1582,
          longitude: 106.7725,
          validDestinations: [],
          createdAt: now,
          updatedAt: now,
        },
      ];

      const liveStatuses: (StationLiveStatus & { station?: Station })[] = [
        {
          id: 'ls-ancol',
          stationId: 's-single',
          station: stations[0],
          crowdState: {},
          delayState: {},
          facilityState: {},
          disruptionState: {
            FLOOD_WEATHER: { status: 'ACTIVE', reportCount: 1, expiresAt: expires },
          },
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'ls-t1',
          stationId: 's-tng1',
          station: stations[1],
          crowdState: {},
          delayState: { 'Tangerang Line:x': { lineName: 'Tangerang Line', majorCount: 5, expiresAt: expires } },
          facilityState: {},
          disruptionState: {},
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'ls-t2',
          stationId: 's-tng2',
          station: stations[2],
          crowdState: {},
          delayState: { 'Tangerang Line:x': { lineName: 'Tangerang Line', majorCount: 5, expiresAt: expires } },
          facilityState: {},
          disruptionState: {},
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'ls-t3',
          stationId: 's-tng3',
          station: stations[3],
          crowdState: {},
          delayState: { 'Tangerang Line:x': { lineName: 'Tangerang Line', majorCount: 5, expiresAt: expires } },
          facilityState: {},
          disruptionState: {},
          createdAt: now,
          updatedAt: now,
        },
      ];

      const feed = service.synthesizeFeed(stations, liveStatuses, now);
      expect(feed.length).toBe(2);
      expect(feed[0].type).toBe('SINGLE_STATION');
      expect(feed[1].type).toBe('MASSIVE_DELAY_EVENT');
    });
  });
});
