# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Hospital Finder** is an online hospital location and navigation system. Users locate hospitals / healthcare facilities near them (or by name, or by medical service), see them on an interactive Google Map, view facility details, and get in-app directions from their location to a selected hospital. Signed-in users (Clerk) can save hospitals.

Data model — everything except the map tiles is a free/keyless API:
- **Map tiles**: Google Maps JavaScript API (only — no billed Google services).
- **Hospital data**: OpenStreetMap (Overpass + Nominatim).
- **Directions**: openrouteservice (free tier), route drawn as a Google `Polyline`.
- **Place autocomplete**: Photon (keyless).

> The repo was pivoted from an eye-care job-search app. If you find lingering "Optic Search" / "eye care" / Gemini references, they are leftovers to remove.

## Commands

```bash
yarn dev                     # dev server at http://localhost:3000
yarn build                   # production build (also lints + typechecks)
yarn start                   # run production build
yarn lint                    # next lint (core-web-vitals + typescript)
yarn prisma generate         # regenerate Prisma client after schema changes
yarn prisma db push          # push schema to the database (no migrations dir)
npx tsc --noEmit             # typecheck only
```

Use **Yarn**, not npm. There is **no test framework** configured.

On Windows, `prisma generate` can fail with `EPERM ... query_engine-windows.dll.node` while `yarn dev` (or another node process) holds the engine binary — the `.d.ts`/JS still regenerate, so typecheck/build are unaffected; stop the dev server if you need a clean regen.

## Environment variables

Copy `env.example` to `.env`. Non-standard names to know:

- `DATA` — Postgres connection string. Prisma's datasource reads `env("DATA")`, **not** `DATABASE_URL`.
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — browser key; only **Maps JavaScript API** need be enabled (map tiles). Exposed to the client by design (restrict by HTTP referrer). Without it, `HospitalMap` renders a fallback; search still works. Read it via `GOOGLE_MAPS_API_KEY` exported from `src/app/providers.tsx`.
- `ORS_API_KEY` — openrouteservice key for `/api/directions`. **Server-side only** (not `NEXT_PUBLIC_`). Free, no card. Without it, `/api/directions` returns 503 and the directions panel shows the message.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` — Clerk auth.

## Architecture

**Data layer — `src/lib/hospitals.ts`.** All hospital data comes from OpenStreetMap:
- `searchHospitalsNearby` — Overpass query for `amenity=hospital|clinic|doctors` and `healthcare=*` within a radius of a point. Fails over between `overpass-api.de` and `overpass.kumi.systems`. Ranks by haversine distance.
- `searchHospitalsByName` — Nominatim text search, viewbox-biased toward the user's location. Beware: Nominatim's `address.amenity` is the POI *name*, not a category — classification uses `extratags` + `place.class`/`place.type` only.
- `getHospitalDetails` — Nominatim `/lookup` by `${osm_type}/${osm_id}` (the `Hospital.id` format).
- `deriveServices` maps OSM `healthcare:speciality` values + name keywords onto the `ServiceCategory` union (`src/types/index.ts`, with `SERVICE_OPTIONS` labels). Extend both places together.

**Request flow.** `page.tsx` builds a `HospitalSearchParams` from location + `SearchState` → `fetchHospitalsWithCache` (`src/lib/hospitalsCache.ts`) → `GET /api/hospitals` (`?lat&lng&radius&service` or `?q=`) → `searchHospitals` dispatches name-vs-nearby. Other routes: `GET /api/hospitals/[id]` (details), `GET /api/geocode?q=` (Nominatim, forward-geocode a typed city on submit), `GET /api/autocomplete?q=&lat=&lng=` (Photon type-ahead), `GET /api/directions?fromLat&fromLng&toLat&toLng&mode` (openrouteservice via `src/lib/directions.ts`), `GET /api/popular-cities?countryCode=` (Wikidata SPARQL).

**Caching (client-side, layered).** `hospitalsCache.ts` — `localStorage`, 6h TTL, keyed by `q:` or rounded `geo:lat,lng:radius:service`. Plus TanStack Query (`src/app/providers.tsx`) with 6h `staleTime` and refetching disabled. The `/api/hospitals` response also sets `s-maxage`.

**Location — `src/lib/useUserLocation.ts`.** Browser Geolocation first, IP fallback (`ipapi.co`), `setManual` for city search. Last good value cached in `localStorage` (`user_location`).

**Map — `src/components/HospitalMap.tsx`.** Wrapped by `<APIProvider>` in `providers.tsx` (no `libraries` — core JS only). Uses legacy `Marker`; the user dot is an inline-SVG data-URI icon (never touch the `google` global during render — it may not be ready). Markers are clustered via `@googlemaps/markerclusterer` in `ClusteredMarkers` (imperative, diffed on the id set). `MapController` handles pan/fit-bounds. `RouteLayer` fetches `/api/directions`, draws the returned `path` as a `google.maps.Polyline`, fits bounds to it, and reports a `DirectionsSummary` (or error string) up via `onDirections`.

**Directions UI.** `page.tsx` owns route state (`routeTo`, `travelMode`, `directionsSummary`, `directionsLoading`, `directionsError`). `HospitalDetails` (antd `Drawer`) shows facility info and embeds `DirectionsPanel` (drive/walk/cycle toggle — no transit, ORS has none — ETA, step list, "Open in Google Maps" deep link). The route is drawn by `HospitalMap`; the panel only renders what it's handed. `src/lib/directions.ts` maps `TravelMode` → ORS profile and throws `DirectionsUnavailableError` (→ 503) when the key is missing/rejected.

**Autocomplete — `src/components/LocationAutocomplete.tsx`.** Debounced (250 ms) fetch to `/api/autocomplete`, custom `role="combobox"` dropdown with arrow/enter/escape keys. Plain typed text still works via the geocode-on-submit path in `SearchBar`.

**Auth + saved hospitals.** `src/middleware.ts` = `clerkMiddleware()`. `src/app/api/bookmarks/*` (`runtime='nodejs'`, `force-dynamic`) call `auth()` and use Prisma. `Bookmark` model: `placeId` holds the OSM id, plus `lat`/`lng` so saved hospitals can be mapped; compound unique key `user_place_unique` drives `upsert`/`delete`. Client helpers + `bookmarkToHospital` in `src/lib/bookmarks.ts`.

**UI system.** Ant Design v5 is the component layer; **build new UI from antd components** (`Button`, `Input`, `Select`, `AutoComplete`, `Segmented`, `Tag`, `Card`, `Drawer`, `Descriptions`, `Timeline`, `Empty`, `Result`, `Skeleton`, `Alert`), themed centrally.
- `src/app/providers.tsx` holds the antd `ConfigProvider` theme (`colorPrimary` `#2563eb`, radius 10/14, Inter, soft shadows, `cssVar: true`) **and** an `<App>` wrapper (`className="contents"`) — so use `App.useApp()` for `message`/`notification`, never the static imports or `message.useMessage()` + contextHolder.
- `src/app/layout.tsx` wraps everything in `<AntdRegistry>` (`@ant-design/nextjs-registry`) for SSR-safe antd styles. Inter is loaded as `--font-inter` and referenced by the antd `fontFamily` token.
- Keep the antd `ConfigProvider` token palette and the `globals.css` `@theme` palette **in sync**.

**Tailwind CSS v4** is active for layout/spacing utilities — `globals.css` imports `tailwindcss/theme.css` + `utilities.css` (no Preflight, so antd and the legacy classes keep their look). Custom colors are in an `@theme` block: `bg-primary`, `text-primary-blue`, `bg-hospital-gray`, `border-[var(--color-line)]`, plus helpers `.surface` (card) / `.hairline` / `.card`. A legacy `.btn-*` / `.input-field` / `.chip` / bare-utility block remains for non-antd markup. Icons: `lucide-react` (size with `h-4 w-4` etc.). Path alias `@/*` → `./src/*`. `next.config.ts` is empty.

**Home layout (`page.tsx`).** Two-pane on `lg`: a fixed 400px left column that is `sticky` + independently scrolls (`SearchBar` + results list), and a `flex-1` sticky map. Below `lg`, a single column with an antd `Segmented` List/Map toggle (`mobileView` state); `isDesktop` (matchMedia) picks which panes mount. Empty/error/loading states use antd `Empty` / `Result` / `LoadingState` (antd `Skeleton` cards).
