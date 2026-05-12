<!--
SPDX-FileCopyrightText: 2026 André Fiedler
SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Search Indexing

PCB Styler is published as a public static browser app at
`https://pcb-styler.app/`. The app shell includes a title, description, robots
directive, canonical URL, and sitemap link. The static deployment artifact also
ships `robots.txt` and `sitemap.xml` from `src/`.

## Code-owned checks

- Keep `src/index.html` free of `noindex` directives unless the public site is
  intentionally removed from search.
- Keep `src/robots.txt` permissive for the app shell and browser assets.
- Keep `src/sitemap.xml` limited to public, canonical URLs that should be
  discoverable.
- Run `npm test` after metadata or crawler-file changes.

## Search Console checks

These items require Google Search Console access and cannot be completed from
the repository alone:

- Verify the `pcb-styler.app` domain property.
- Submit `https://pcb-styler.app/sitemap.xml`.
- Use URL Inspection for `https://pcb-styler.app/`.
- Request indexing for important public URLs after deployment.
