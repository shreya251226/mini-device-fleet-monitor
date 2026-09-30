<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules

- Fleet domain logic lives in `src/lib/fleet/store.ts` and stays framework-free; HTTP routes only
  validate input and map domain errors, so the rules stay unit-testable without a server.
- Device ONLINE/OFFLINE status is derived on read from `now - last_heartbeat`, never stored or
  updated by a background timer, so status is always exact.
- External HTTP callers (the simulator) use `src/routes/api/public/*`, which bypasses site auth.
- Unit tests live in `tests/` and run with `npm test` via the standalone `vitest.config.ts`.
