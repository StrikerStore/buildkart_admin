import 'server-only';
import { api } from '@/lib/api/server';

/**
 * What the admin's maps need: a Google browser key, or null when the shop is
 * not on Google, plus where a map with nothing to show should open.
 *
 * Read from the public `storefrontCheckout` rather than `checkoutConfig`: the
 * latter needs `settings:write`, and somebody packing orders should still see
 * where the order goes. The browser key is public by design — it is already on
 * every storefront page — and the geocoding key is not on this DTO at all.
 */
export type AdminMap = {
  apiKey: string | null;
  lat: number;
  lng: number;
  zoom: number;
};

export async function adminMap(): Promise<AdminMap> {
  const { location } = await (await api()).content.storefrontCheckout.query();
  const google = location.provider === 'GOOGLE' && location.browserKey !== '';

  return {
    apiKey: google ? location.browserKey : null,
    lat: location.defaultLat,
    lng: location.defaultLng,
    zoom: location.defaultZoom,
  };
}
