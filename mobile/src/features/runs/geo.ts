export type GeoPoint = {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
};

const EARTH_RADIUS_M = 6371000;

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

export function haversineMeters(a: GeoPoint, b: GeoPoint) {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type GpsSegment = {
  distanceMeters: number;
  elapsedSeconds: number;
  accuracy: number;
};

export type GpsDecision = {
  accept: boolean;
  reason?: 'accuracy' | 'tooSoon' | 'tooFar' | 'tooFast';
};

export function decideGpsSegment(segment: GpsSegment): GpsDecision {
  if (!Number.isFinite(segment.accuracy) || segment.accuracy > 50) {
    return { accept: false, reason: 'accuracy' };
  }
  if (!Number.isFinite(segment.elapsedSeconds) || segment.elapsedSeconds < 1) {
    return { accept: false, reason: 'tooSoon' };
  }
  if (!Number.isFinite(segment.distanceMeters) || segment.distanceMeters < 1.5) {
    return { accept: false, reason: 'tooFar' };
  }
  if (segment.elapsedSeconds > 30) {
    return { accept: false, reason: 'tooFar' };
  }
  const speed = segment.distanceMeters / segment.elapsedSeconds;
  if (speed > 12) {
    return { accept: false, reason: 'tooFast' };
  }
  return { accept: true };
}

export function metersToKm(meters: number) {
  return Math.round(meters / 10) / 100;
}
