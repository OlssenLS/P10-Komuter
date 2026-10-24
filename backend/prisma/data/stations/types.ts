import { TransportType } from '@prisma/client';

export interface StationSeedData {
  name: string;
  isTransitHub?: boolean;
  supportedTypes: TransportType[];
  lineNames: string[];
  latitude: number;
  longitude: number;
}
