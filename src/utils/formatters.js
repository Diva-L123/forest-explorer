'use strict';

export function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatArea(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value || 'Unknown');
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M km²';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k km²';
  return num.toLocaleString() + ' km²';
}

export function formatCoordinates(coordinates) {
  if (!coordinates || !Number.isFinite(Number(coordinates.lat)) || !Number.isFinite(Number(coordinates.lng))) {
    return 'Coordinates unavailable';
  }
  const lat = Number(coordinates.lat);
  const lng = Number(coordinates.lng);
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}° ${latDir}, ${Math.abs(lng).toFixed(2)}° ${lngDir}`;
}

export function estimateReadingTime(text) {
  const words = String(text || '').trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
}

export function capitalize(value) {
  if (!value) return '';
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

/**
 * Calculates Great-Circle distance between two coordinates in kilometers using Haversine formula
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
