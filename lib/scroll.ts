/** The id of the shell's scrolling content column. */
export const MAIN_SCROLL_ID = 'admin-main';

/**
 * Scrolls the content column back to the top.
 *
 * The shell pins the sidebar and top bar and gives `main` the only scrollbar,
 * so `window.scrollTo` does nothing here — a form that raised an error at the
 * top of the page would look like it had silently failed. Falls back to the
 * window for pages rendered outside the shell, such as login.
 */
export function scrollMainToTop(behavior: ScrollBehavior = 'smooth'): void {
  const main = typeof document === 'undefined' ? null : document.getElementById(MAIN_SCROLL_ID);
  if (main) {
    main.scrollTo({ top: 0, behavior });
    return;
  }
  if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior });
}
