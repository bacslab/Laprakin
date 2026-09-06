# Landing and Admin Operations Refresh Design

**Status:** approved for implementation in the active task continuation

## Goal

Polish the landing hero and feature cards, make the AI control plane feel like a coherent part of the admin console, replace the legacy activity bars with useful interactive monitoring, and add a relevance-ranked admin-wide search.

## Current evidence

- `LandingView.jsx` renders the hero copy and feature cards, while `landing.css` owns the landing tokens and section layout.
- `OverviewRoute.jsx` currently renders ten metric tiles and a CSS `.activity-bars` chart over the last six days.
- `LegacyAdminWorkspace.jsx` embeds `AdminAiWorkspace`, which still renders a second AI topbar and an additional navigation row inside the admin content area.
- Admin APIs already expose `/admin/overview`, `/admin/ai/usage`, users, alerts, audit, and AI configuration resources; user identifiers are masked by existing server helpers.

## Design

### Landing

Use a centered content measure on `.fg-hero-copy p` with explicit `text-align: center`, `margin-inline: auto`, and a readable max width. Reduce `--fg-border` and the stronger border token so the whole landing system uses a quiet 24–28% line treatment. Set feature-card copy to left alignment and reuse the step-card heading size/line-height tokens, preserving the 22px title-to-paragraph rhythm already established.

### Admin shell and AI controls

Keep one `admin-workspace` shell and one global admin header. In embedded mode the AI control plane owns only its content header, page intro, filters, panels, and action controls; it must not render a second app-level topbar. Add shared spacing variables and panel section gaps, then tune responsive layouts so controls never touch or overlap. AI keeps its muted olive accent and data-dense typography, but inherits the admin shell geometry and theme.

### Monitoring

Add `recharts` as a client dependency and create a focused monitoring view using responsive `AreaChart`/`LineChart` components. The primary visual is request volume with success/error series; a secondary visual shows latency percentiles and token usage. The view uses compact summary figures only for the most important outcomes (availability, error rate, p95 latency, tokens), followed by charts and a detailed table. Filters are reflected in the URL and include period (24h/7d/30d), provider, model, route, and status. The existing server usage endpoint is extended with the filtered series needed by the charts, without returning prompts or generated content.

### Admin-wide search

Add `/api/admin/search` with bounded `q`, `kind`, and `limit` parameters. Search features/routes from a curated server-safe catalog plus providers/models, masked user references, alerts, audit actions, and feedback subjects when the caller has the corresponding capability. Rank exact matches above prefix matches, token matches, and bounded fuzzy matches; return category, title, subtitle, target path, score, and matched fields. The client adds a `Ctrl/⌘+K` command palette with debounce, keyboard navigation, recent searches, grouped results, match highlighting, and direct navigation. No unmasked PII or document/chat content is returned.

## Data flow and failure handling

The monitoring view requests one filtered JSON resource and shows stale data with an inline retry state if a refresh fails. Search debounces requests, cancels stale queries, and falls back to a local feature catalog when the endpoint is unavailable; it never blocks navigation. Server search validates and caps every input, applies capability checks per result family, and returns an empty result set for a blank query.

## Verification

- Contract tests cover hero centering, border opacity, feature-card alignment/heading parity, embedded AI shell structure, monitoring filters/series, and search ranking/capability masking.
- Run all client and server tests, lint, typecheck, production build, and `git diff --check`.
- Refresh the local preview at `http://localhost:5173`, inspect landing and admin monitoring/search states, then deploy and verify the production health endpoint and asset hashes.
