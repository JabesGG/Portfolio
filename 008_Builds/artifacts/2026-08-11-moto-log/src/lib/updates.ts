/**
 * Watches for a newer build and lets the page take it, on a tap.
 *
 * The worker never activates itself: a forced reload could throw away a
 * half-typed entry. But leaving it entirely to "close every instance" made
 * updates genuinely hard to receive on a phone, where backgrounding is not
 * closing. So the page asks, and you decide.
 */
export type OnUpdate = (apply: () => void) => void;

export function watchForUpdate(onUpdate: OnUpdate): void {
  if (!("serviceWorker" in navigator)) return;

  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  navigator.serviceWorker.getRegistration().then(reg => {
    if (!reg) return;

    const offer = (worker: ServiceWorker) =>
      onUpdate(() => {
        worker.postMessage("SKIP_WAITING");
      });

    // Already waiting from a previous visit.
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);

    reg.addEventListener("updatefound", () => {
      const installing = reg.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        // `controller` is null on the very first install — that is not an
        // update, it is the app arriving for the first time.
        if (installing.state === "installed" && navigator.serviceWorker.controller) {
          offer(installing);
        }
      });
    });

    // Ask the network whether there is something newer. Without this the check
    // only happens on navigation, which an installed app may not do for days.
    reg.update().catch(() => { /* offline is fine; try again next launch */ });
  }).catch(() => { /* no registration yet */ });
}
