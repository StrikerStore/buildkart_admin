// `tsconfig` limits global types to `node`; this file needs `google.maps`.
/// <reference types="google.maps" />
'use client';

import { useEffect, useRef, useState } from 'react';
import { LoaderCircleIcon, MapPinIcon } from 'lucide-react';

/**
 * Pick a point by dragging a Google map under a fixed pin.
 *
 * The storefront's gesture (website `components/location/google-map.tsx`),
 * copied rather than shared because admin and website are separate repos. The
 * map moves, the pin stays dead centre, and each settled drag reports the
 * coordinate under it — rounded to the seven places `Decimal(10, 7)` stores,
 * so what the form shows is exactly what gets saved.
 *
 * Two-way: `value` changing from outside (someone typing into the lat/lng
 * fields) recentres the map. A change that *came from* the map is recognised
 * and ignored, or a drag would bounce the map back to where it started.
 */
export type PinPickerProps = {
  apiKey: string;
  value: { lat: number; lng: number } | null;
  /** Where to open when `value` is empty — the shop's default map centre. */
  fallback: { lat: number; lng: number; zoom: number };
  onChange: (lat: string, lng: string) => void;
};

let configured = false;

async function loadMaps(apiKey: string) {
  // Imported here, not at the top: the loader touches `window`, and this file
  // is still rendered on the server as part of a Client Component tree.
  const { importLibrary, setOptions } = await import('@googlemaps/js-api-loader');
  if (!configured) {
    setOptions({ key: apiKey, v: 'weekly', region: 'IN' });
    configured = true;
  }
  return importLibrary('maps');
}

const round = (value: number) => value.toFixed(7);

export function PinPicker({ apiKey, value, fallback, onChange }: PinPickerProps) {
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');

  const changed = useRef(onChange);
  changed.current = onChange;

  // The last coordinate this map reported, so its echo through `value` is
  // not mistaken for somebody typing.
  const reported = useRef<string | null>(null);
  // Where typed coordinates last sent the map, so arriving there is not
  // reported back — that would rewrite "22.7" as "22.7000000" mid-keystroke.
  const target = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let idle: google.maps.MapsEventListener | null = null;

    window.gm_authFailure = () => setStatus('failed');

    loadMaps(apiKey)
      .then(({ Map }) => {
        if (cancelled || !holder.current) return;

        const instance = new Map(holder.current, {
          center: value ?? fallback,
          zoom: value ? 17 : fallback.zoom,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: 'greedy',
        });

        // The opening view is not a choice; only a drag after it is.
        let opened = false;
        idle = instance.addListener('idle', () => {
          if (!opened) {
            opened = true;
            return;
          }
          const point = instance.getCenter();
          if (!point) return;
          const lat = round(point.lat());
          const lng = round(point.lng());
          const here = `${lat},${lng}`;
          if (here === target.current) return;
          target.current = null;
          reported.current = here;
          changed.current(lat, lng);
        });

        map.current = instance;
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('failed');
      });

    return () => {
      cancelled = true;
      idle?.remove();
      map.current = null;
      window.gm_authFailure = undefined;
    };
    // Mount once; later values arrive through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Typed coordinates move the map.
  useEffect(() => {
    if (!map.current || !value) return;
    const point = `${round(value.lat)},${round(value.lng)}`;
    if (point === reported.current) return;
    target.current = point;
    map.current.panTo(value);
  }, [value?.lat, value?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'failed') {
    return (
      <p className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
        Google Maps would not load with this key — check it is allowed for this domain and has the
        Maps JavaScript API enabled. Type the coordinates instead.
      </p>
    );
  }

  return (
    <div className="relative h-64 overflow-hidden rounded-md border">
      <div ref={holder} className="size-full" />

      {/* The pin: fixed, the map moves under it. The point sits on the centre pixel. */}
      <MapPinIcon
        className="pointer-events-none absolute top-1/2 left-1/2 size-8 -translate-x-1/2 -translate-y-full fill-[var(--nav)] text-white drop-shadow"
        strokeWidth={1.5}
        aria-hidden
      />

      {status === 'loading' && (
        <div className="bg-muted/60 absolute inset-0 grid place-items-center">
          <LoaderCircleIcon className="text-muted-foreground size-5 animate-spin" aria-hidden />
        </div>
      )}
    </div>
  );
}

declare global {
  interface Window {
    /** Called by the Maps script when the key is refused. */
    gm_authFailure?: () => void;
  }
}
