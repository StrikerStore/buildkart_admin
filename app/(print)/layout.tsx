/**
 * The print surface.
 *
 * A route group of its own so printable pages escape the admin shell entirely —
 * no sidebar, no top bar, nothing that would waste the top third of an A4
 * sheet. Route groups do not appear in the URL, so /orders/[id]/invoice still
 * sits where it reads like it should.
 */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-white text-black">{children}</div>;
}
