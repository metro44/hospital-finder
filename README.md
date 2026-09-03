# Hospital Finder

An online hospital location and navigation system. Users find hospitals and
healthcare facilities near them (or by name / medical service), view facility
details on an interactive Google Map, and get turn-by-turn directions from their
location to a selected hospital.

## Features

- **Locate hospitals** near your current location, in a searched city, or by name.
- **Filter by medical service** — emergency, maternity, paediatrics, cardiology,
  dental, eye care, radiology, mental health, and more.
- **Interactive map** (Google Maps) with a marker per facility and an info window.
- **Facility details** — address, phone, email, website, opening hours and the
  services a facility offers.
- **In-app directions** — route drawn on the map with distance, ETA and
  step-by-step instructions, a driving/walking/transit/cycling toggle, and an
  "Open in Google Maps" link.
- **Save hospitals** to your account (sign in with Clerk).

## Tech stack

- **Framework**: Next.js 15 (App Router), React 19, TypeScript
- **Map**: Google Maps JavaScript API via
  [`@vis.gl/react-google-maps`](https://visgl.github.io/react-google-maps/) —
  only the map tiles; no billed Google services are used
- **Directions**: [openrouteservice](https://openrouteservice.org) (free tier,
  ~2000 routes/day) — route drawn as a polyline on the Google map
- **Hospital data**: OpenStreetMap — Overpass API (nearby search) and Nominatim
  (name search, geocoding)
- **Place autocomplete**: [Photon](https://photon.komoot.io) (free, key-less)
- **Auth**: Clerk · **Database**: PostgreSQL via Prisma
- **Data fetching**: TanStack Query · **UI**: Ant Design + Tailwind CSS v4

## Getting started

```bash
yarn install
cp env.example .env      # then fill in the values
yarn prisma db push      # create the Bookmark table
yarn dev                 # http://localhost:3000
```

### Environment variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Browser key with only **Maps JavaScript API** enabled (map tiles). Restrict by HTTP referrer. Without it the map shows a fallback; search still works. |
| `ORS_API_KEY` | [openrouteservice](https://openrouteservice.org/dev/) key for directions. Free, no credit card. Server-side only. Without it, directions show a "not configured" message. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk authentication. |
| `DATA` | Postgres connection string. Prisma reads `env("DATA")`, **not** `DATABASE_URL`. |

Hospital search and place autocomplete need no key (public OpenStreetMap-based APIs).

## Scripts

```bash
yarn dev        # dev server
yarn build      # production build
yarn start      # run the production build
yarn lint       # eslint (next/core-web-vitals + next/typescript)
```

## How search works

1. The browser resolves the user's location (Geolocation API, then an IP
   fallback, or a typed city geocoded via Nominatim).
2. `GET /api/hospitals?lat&lng&radius&service` runs an Overpass query for
   `amenity=hospital|clinic|doctors` and `healthcare=*` around that point, and
   normalises each element into a `Hospital` (services derived from
   `healthcare:speciality` tags and name keywords).
3. `GET /api/hospitals?q=` instead runs a Nominatim name search, biased towards
   the user's location.
4. Results are cached in `localStorage` (6 h) and by TanStack Query.

## How directions work

Selecting **Directions** for a hospital calls `GET /api/directions` (server-side
openrouteservice) for a route from the user's location. The returned polyline is
drawn on the Google map with distance, ETA and turn-by-turn steps, plus an
"Open in Google Maps" link. Modes: driving, walking, cycling (openrouteservice
has no public-transit routing).

## Notes & limitations

- OpenStreetMap coverage and tag completeness vary by region — some facilities
  lack phone numbers, opening hours or tagged specialities.
- OSM has no ratings, reviews or photos, so those are not shown.
- Overpass is a shared public service and can be slow or rate-limited; the app
  fails over to a mirror and caches aggressively.
- openrouteservice free tier is ~2000 routes/day, 40/min.
