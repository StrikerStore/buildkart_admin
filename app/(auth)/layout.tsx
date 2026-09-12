import { BuildKartMark } from '@/components/shell/BuildKartMark';

/**
 * The sign-in surface.
 *
 * A route group with its own layout, like `(print)`: these pages render outside
 * the admin shell entirely — no sidebar, no top bar, no session to read — and
 * this is where that fact is stated once rather than in every page.
 *
 * The brand panel is the only charcoal ground in the app outside the navigation
 * rail, and it follows the rail's rule exactly: the yellow lives inside the mark
 * and nowhere else. The moment it tints a divider or a bullet it stops meaning
 * "this is where you are", which is the only thing it is for.
 *
 * Three things here are load-bearing and look arbitrary:
 *
 *   - **`min-h-full`, not `min-h-screen`.** `globals.css` sets `html, body {
 *     height: 100% }`, so a percentage minimum already resolves to the viewport.
 *   - **No `h-full` on the panel.** A percentage *height* resolves against the
 *     parent's height, and a parent carrying only `min-height` is `height: auto`
 *     for that purpose — the panel would collapse to its content. The grid's
 *     default `align-items: stretch` fills the column with no height class.
 *   - **The `<main>` must not have an `id`.** `globals.css` clamps
 *     `html:has(#admin-main)` to `overflow: hidden`, and login is exempt only
 *     because it never renders `AdminShell`. That exemption is what lets a short
 *     landscape viewport scroll far enough to reach the form.
 *
 * Note for whoever adds `/forgot-password` to this group: `proxy.ts`'s matcher
 * only exempts paths beginning `login`. A new route here is matched, finds no
 * session cookie, and is redirected straight back to `/login`. Add it there too.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-full lg:grid-cols-[1fr_480px]">
      {/*
       * Hidden rather than stacked on a phone. It is a backdrop, not content:
       * pushed above the form it would be four paragraphs between the customer
       * and the only thing they came here to do.
       */}
      <aside className="bg-nav hidden flex-col justify-between p-10 lg:flex xl:p-14">
        <BuildKartMark size="lg" tone="light" />

        {/*
         * A `<p>`, not an `<h2>`. This column comes first in the DOM but reads
         * second, so a heading here would sit above the page's own `<h1>` and
         * leave the outline starting at level two.
         */}
        <div className="max-w-[420px]">
          <p className="text-2xl leading-tight font-semibold tracking-tight text-white">
            Run the counter from one screen.
          </p>

          <ul className="divide-nav-border text-nav-foreground mt-7 divide-y border-y text-sm">
            <li className="py-3">Orders from the site arrive the moment they are placed.</li>
            <li className="py-3">Rates, stock and delivery pincodes live in one place.</li>
            <li className="py-3">Print an order slip or an invoice from the order itself.</li>
            <li className="py-3">Every change is recorded against whoever made it.</li>
          </ul>
        </div>

        <p className="text-nav-muted text-xs">Authorised access only.</p>
      </aside>

      <main className="flex items-center justify-center px-4 py-12 sm:px-8">{children}</main>
    </div>
  );
}
