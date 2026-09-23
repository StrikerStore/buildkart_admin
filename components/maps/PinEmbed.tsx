import { ExternalLinkIcon } from 'lucide-react';

/**
 * Where a delivery pin is, on a small map.
 *
 * The Maps Embed API rather than the JavaScript one: a plain iframe, no script
 * on the page, and free with no usage cap — which suits a picture somebody
 * glances at while packing. `loading="lazy"` keeps a closed `<details>` or an
 * off-screen card from loading it at all.
 *
 * Without a key it is just the link, which needs none.
 */
export function PinEmbed({
  apiKey,
  lat,
  lng,
  title = 'Delivery pin',
}: {
  apiKey: string | null;
  lat: number;
  lng: number;
  title?: string;
}) {
  const point = `${lat},${lng}`;
  const link = `https://www.google.com/maps/search/?api=1&query=${point}`;

  return (
    <div className="flex flex-col gap-1.5">
      {apiKey && (
        <iframe
          title={title}
          src={`https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(apiKey)}&q=${point}&zoom=17`}
          className="h-48 w-full rounded-md border"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      )}
      <a
        href={link}
        target="_blank"
        rel="noreferrer"
        className="text-muted-foreground inline-flex items-center gap-1 text-xs hover:underline"
      >
        <span className="font-mono tabular-nums">
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </span>
        <ExternalLinkIcon className="size-3" aria-hidden />
        Open in Google Maps
      </a>
    </div>
  );
}
