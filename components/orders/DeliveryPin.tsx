'use client';

import { useEffect, useRef, useState } from 'react';
import { LoaderCircleIcon, MapPinIcon, SearchIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PinPicker } from '@/components/maps/PinPicker';
import {
  placeLocation,
  searchPlaces,
  type PlaceSuggestionDto,
} from '@/app/(dashboard)/orders/new/actions';
import type { AdminMap } from '@/lib/maps';

export type Pin = { lat: number; lng: number };

/**
 * The exact drop point for a phone order: search the colony, then drag the map
 * until the pin sits on the site gate.
 *
 * The storefront's checkout asks for the same thing, and for the same reason:
 * distance-priced products (sand by the hyva, gitti) and the delivery charge
 * are measured to this point, and the driver navigates to it. Optional — an
 * order without a pin is priced at 0 km, as the counter always was.
 */
export function DeliveryPin({
  map,
  value,
  onChange,
}: {
  map: AdminMap;
  value: Pin | null;
  onChange: (pin: Pin | null) => void;
}) {
  const [open, setOpen] = useState(value !== null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceSuggestionDto[]>([]);
  const [searching, setSearching] = useState(false);
  const [picking, setPicking] = useState(false);
  const [lookupFailed, setLookupFailed] = useState(false);
  // One Google billing session per search-then-pick, as the storefront does.
  const session = useRef<string | undefined>(undefined);

  // A saved address with a pin arrives from outside; show the map for it.
  useEffect(() => {
    if (value) setOpen(true);
  }, [value]);

  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      session.current ??= globalThis.crypto?.randomUUID?.();
      setSearching(true);
      const found = await searchPlaces(query, session.current);
      setSearching(false);
      setResults(found);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  async function pick(place: PlaceSuggestionDto) {
    setLookupFailed(false);
    let point: { latitude: number; longitude: number } | null =
      place.latitude !== null && place.longitude !== null
        ? { latitude: place.latitude, longitude: place.longitude }
        : null;
    if (!point && place.placeId) {
      setPicking(true);
      point = await placeLocation(place.placeId, session.current);
      setPicking(false);
    }
    session.current = undefined;
    if (!point) {
      setLookupFailed(true);
      return;
    }
    setQuery('');
    setResults([]);
    onChange({ lat: point.latitude, lng: point.longitude });
  }

  if (!map.apiKey) {
    return (
      <p className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
        Maps are not set up, so this order is priced at 0 km. Add a Google browser key under Checkout
        → Location to drop a pin here.
      </p>
    );
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" onClick={() => setOpen(true)} className="self-start">
        <MapPinIcon className="size-4" />
        Pin the exact delivery location
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Delivery pin</span>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
          >
            <XIcon className="size-3.5" />
            Remove pin
          </button>
        )}
      </div>

      <div className="relative">
        <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the colony, society or landmark"
          className="pl-8"
          aria-label="Search for the delivery area"
        />
        {(searching || picking) && (
          <LoaderCircleIcon className="text-muted-foreground absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin" />
        )}
      </div>

      {results.length > 0 && (
        <ul className="max-h-[220px] overflow-y-auto rounded-md border">
          {results.map((place, index) => (
            <li key={place.placeId ?? `${place.label}-${index}`} className="border-b last:border-b-0">
              <button
                type="button"
                onClick={() => pick(place)}
                className="hover:bg-muted/50 flex w-full flex-col px-3 py-2 text-left transition-colors"
              >
                <span className="truncate font-medium">{place.label}</span>
                {place.sublabel && (
                  <span className="text-muted-foreground truncate text-xs">{place.sublabel}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!searching && query.trim().length >= 3 && results.length === 0 && (
        <p className="text-muted-foreground text-xs">No places found. Drag the map instead.</p>
      )}
      {lookupFailed && (
        <p className="text-xs text-[var(--critical-fg)]">
          Could not find that place on the map. Try another, or drag the map.
        </p>
      )}

      <PinPicker
        apiKey={map.apiKey}
        value={value}
        fallback={map}
        onChange={(lat, lng) => onChange({ lat: Number(lat), lng: Number(lng) })}
      />

      <p className="text-muted-foreground text-xs">
        {value ? (
          <>
            Pinned at{' '}
            <span className="tabular">
              {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
            </span>
            . Ask the customer for a landmark and drag until the pin sits on the site gate.
          </>
        ) : (
          'Search the area, then drag the map until the pin sits on the site gate. Distance-priced items and the delivery charge are measured to this point.'
        )}
      </p>
    </div>
  );
}
