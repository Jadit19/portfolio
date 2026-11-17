/**
 * The Zingle route: a rally roadbook of what I built as Founding Engineer at Zingle.
 * Content is drawn from the READMEs under references/work/zingle/.
 */

import type { Stop } from "./types";

export interface WaypointStop extends Stop {
  /** The rally-roadbook line under the title, e.g. "Waypoint 3 · the cost ledger". */
  waypoint: string;
  /** The stop's headline number or fact, shown big on a board. */
  headline: string;
}

export const ZINGLE_INTRO =
  "As Founding Engineer at Zingle, an AI platform that helps data teams build, test and optimise " +
  "dbt models through chat, I own everything that isn't frontend. Since May 2026 I have founded " +
  "four product lines and built the platform layers the rest of the team builds on.";

export const ZINGLE_STOPS: WaypointStop[] = [
  {
    id: "zingle/ai-optimisation-engine",
    title: "AI dbt Optimisation Engine",
    waypoint: "Waypoint 1 · the savings scanner",
    headline: "2,000 scans a week",
    tagline: "An AI engine that scans whole dbt projects and opens fix PRs",
    art: "ai-optimisation-engine",
    period: "Jun – Sep 2026",
    facts: [
      { label: "Customers", value: "15+ paying organisations" },
      { label: "Scale", value: "~2,000 scans a week" },
      { label: "Accepted", value: "75–85% of suggestions" },
      { label: "Detectors", value: "8 on the framework, 5 by teammates" },
    ],
    body: [
      {
        kind: "p",
        text:
          "Before my first commit, the product only acted when a user opened a chat, and nothing " +
          "looked across a whole dbt project for savings. I founded an engine that scans every " +
          "model with LLM detectors, applies each fix in an isolated workspace, opens a GitHub PR " +
          "and hands the user a chat bound to that suggestion. It now serves 15+ paying " +
          "organisations across 8 deployments, and 75–85% of its suggestions are accepted.",
      },
      {
        kind: "list",
        items: [
          "A detector framework that checks models in parallel with per-model timeouts; a new " +
            "suggestion type is one subclass plus a registry entry.",
          "8 detectors run on it today: I wrote 3, including source-schema drift and a generic " +
            "detector for customer-defined agents, and teammates built 5.",
          "A PR-aware lifecycle with ordered row locks, so suggestions can be shared and " +
            "re-allocated safely and never stay stuck mid-fix.",
          "A scheduler and worker framework built in five days as a 6-PR stack, with a race-free " +
            "atomic job claim and no lock service. It now runs 12 workers and 6 job types.",
          "Cooperative cancellation on shutdown with a bounded abort latency across the scan " +
            "pipeline.",
        ],
      },
    ],
    tech: ["Python", "asyncio", "FastAPI", "PostgreSQL", "Claude Agent SDK", "GitHub Apps"],
    links: [],
  },
  {
    id: "zingle/blue-green-deployments",
    title: "Blue-Green Deployments for dbt",
    waypoint: "Waypoint 2 · blue lane, green lane",
    headline: "On for every org",
    tagline: "Test a risky dbt change over real builds before merging it",
    art: "blue-green-deployments",
    period: "Oct – Nov 2026",
    facts: [
      { label: "Rollout", value: "On for every organisation" },
      { label: "Legacy retired", value: "29,901 lines in 190 files" },
      { label: "Tests", value: "~1,580 Python test functions" },
      { label: "Agent tools", value: "9 MCP tools" },
    ],
    body: [
      {
        kind: "p",
        text:
          "Data teams wanted to try a risky model change, like switching a table to incremental, " +
          "against real data before merging. I built a rollout engine that rebuilds the old and " +
          "new code side by side in isolated scratch schemas, compares them as whole tables, " +
          "prices every build in dollars and has AI explain the difference while code decides " +
          "the verdict. It has been on for every organisation since November 2026, and I retired " +
          "the 29.9k-line legacy system it replaced.",
      },
      {
        kind: "list",
        items: [
          "A compile-time routing proof: before anything is written, the compiled dbt manifest " +
            "must show that every selected model lands in scratch.",
          "Distributed work claiming with fencing tokens, heartbeats and a stale reaper, plus " +
            "database triggers that make scratch cleanup orphan-proof.",
          "AI rollout summaries that run read-only over facts computed by code: the model " +
            "explains, code rules.",
          "9 MCP tools that let the chat agent read verdicts and suggest settings, while only the " +
            "user can start a deployment.",
          "The legacy system retired cleanly behind a dry-run teardown script, a fail-closed " +
            "migration and a downtime runbook.",
        ],
      },
    ],
    tech: ["Python", "dbt", "PostgreSQL", "Snowflake", "Claude Agent SDK", "MCP"],
    links: [],
  },
  {
    id: "zingle/cost-ledger",
    title: "Per-Run Cost Ledger",
    waypoint: "Waypoint 3 · the cost ledger",
    headline: "~500k runs/ingest",
    tagline: "One consistent dollar cost for every dbt model, on every screen",
    art: "cost-ledger",
    period: "Sep – Oct 2026",
    facts: [
      { label: "Scale", value: "~500k runs (~1.3M statements) per ingest" },
      { label: "Guarantee", value: "Exactly-once storage" },
      { label: "Reach", value: "6+ product surfaces and the AI tools" },
      { label: "Index win", value: "459 ms → ~0.9 ms" },
    ],
    body: [
      {
        kind: "p",
        text:
          "Cost is the product's core value claim, but the same dbt model showed different " +
          "dollar figures on different screens. I designed a per-run ledger fed by an " +
          "idempotent, watermarked, streaming ingest from the warehouse's query history, and " +
          "moved every cost figure onto one read path. Every screen and AI tool now agrees, and " +
          "the ingest is built to stream ~500k runs per pass in bounded memory.",
      },
      {
        kind: "list",
        items: [
          "Streaming fetches, on-the-fly grouping and flushes sized to Postgres's bind-parameter " +
            "budget, so memory stays flat however large the window.",
          "At-most-once fire, at-least-once ingest, exactly-once storage: the watermark only " +
            "moves after a commit, and re-scans are no-ops.",
          "Sliced backfills that retry a timed-out slice as narrower ones, with each run owned by " +
            "exactly one slice.",
          "Precomputed 30-day aggregates refreshed in a global lock order, and one shared " +
            'definition of "last 30 days" across 52 files.',
          "Live warehouse probes and EXPLAIN plans drove the design, including a composite index " +
            "that cut a 459 ms scan to ~0.9 ms.",
        ],
      },
    ],
    tech: ["Python", "asyncio", "PostgreSQL", "Snowflake", "SQLAlchemy", "FastAPI"],
    links: [],
  },
  {
    id: "zingle/migration-validation",
    title: "Migration Validation and AI Investigations",
    waypoint: "Waypoint 4 · source meets destination",
    headline: "23k → 300 queries",
    tagline: "Continuous checks that a migrated table still matches its source",
    art: "migration-validation",
    period: "Sep – Oct 2026",
    facts: [
      { label: "Warehouses", value: "Snowflake, Postgres, Spark" },
      { label: "Backfill", value: "~23,000 → ~300 statements" },
      { label: "Scale", value: "20–25 monitors per project" },
      { label: "Delivery", value: "19 PRs, incl. an 11-PR stack" },
    ],
    body: [
      {
        kind: "p",
        text:
          "Zingle's migration product moves dbt workloads to a cheaper warehouse, mostly Spark, " +
          "and teams need ongoing proof that source and destination still agree. I built a " +
          "two-table monitoring engine with a gap-free run grid, cheap chunked backfills and an " +
          "AI agent that explains drifts through read-only tools. The redesigned backfill cuts a " +
          "30-day catch-up from ~23,000 warehouse statements to ~300.",
      },
      {
        kind: "list",
        items: [
          "A pipeline that never holds a Postgres transaction open while profiling the " +
            "warehouse, which can take tens of minutes.",
          "A 9-rung verdict ladder, from missing mappings through schema and row drift to clean, " +
            "with a recorded trace.",
          "An AI investigation agent with 4 read-only tools over stored results, chosen over a " +
            "live-data design for a smaller attack surface.",
          "A two-lane sweeper so catch-up backfills never starve live monitors, with backoff " +
            "ceilings per failure cause.",
          "Migration projects and tasks with org scoping and private investigations.",
        ],
      },
    ],
    tech: ["Python", "asyncio", "PostgreSQL", "Spark", "Snowflake", "LLM agents"],
    links: [],
  },
  {
    id: "zingle/custom-agent-platform",
    title: "Custom AI Agent Platform",
    waypoint: "Waypoint 5 · build your own rider",
    headline: "100–120 agents/org",
    tagline: "Versioned, customer-defined AI agents that run with no code",
    art: "custom-agent-platform",
    period: "May – Sep 2026",
    facts: [
      { label: "Scale", value: "100–120 custom agents per org" },
      { label: "Model", value: "3 scopes × 3 lifecycle states" },
      { label: "Agent changes", value: "No redeploy needed" },
      { label: "Tests", value: "~550 test functions" },
    ],
    body: [
      {
        kind: "p",
        text:
          "Agent behaviour lived in a hardcoded Python registry, so every change meant a " +
          "redeploy. I turned it into a versioned, multi-tenant platform where customers draft, " +
          "publish and share their own agents, and those agents run as optimisation scanners " +
          "without any detector code. Organisations now run 100–120 custom agents each.",
      },
      {
        kind: "list",
        items: [
          "Agent and skill versioning across system, org and user scopes, with a draft, " +
            "published and archived lifecycle.",
          "Race-safe invariants in PostgreSQL, such as idempotent draft creation through a " +
            "partial unique index.",
          "Version pinning from detection through apply and chat, so a fix always runs the agent " +
            "version that found it.",
          "Database-backed configuration with a cached settings service and a startup gate.",
          "Session sharing, shipped in 3 days: hand an in-progress AI chat to a colleague as a " +
            "point-in-time fork of the conversation, git workspace, scratch schema and agent memory.",
        ],
      },
    ],
    tech: ["Python", "FastAPI", "PostgreSQL", "Pydantic", "Claude Agent SDK", "Next.js"],
    links: [],
  },
  {
    id: "zingle/mcp-tool-platform",
    title: "MCP Agent-Tool Platform",
    waypoint: "Waypoint 6 · the tool kit",
    headline: "~133 AI tools",
    tagline: "The tenant-safe contract every AI tool on the platform is built on",
    art: "mcp-tool-platform",
    period: "May – Jul 2026",
    facts: [
      { label: "Scale", value: "~133 tools on 4 MCP servers" },
      { label: "Toolsets", value: "24" },
      { label: "Tenant IDs from the model", value: "None" },
      { label: "Extended by", value: "4+ other engineers" },
    ],
    body: [
      {
        kind: "p",
        text:
          "Every AI tool used to ask the LLM to pass tenant IDs itself, which was error-prone " +
          "and let a model reach across tenants. I redesigned the contract so the server derives " +
          "session context and no tool takes an ID from the model, then grew it into the " +
          "foundation the team builds on. It now carries ~133 tools on 4 MCP servers.",
      },
      {
        kind: "list",
        items: [
          "A response decorator that owns serialisation, errors and logging, and offloads " +
            "oversized results to the workspace.",
          "Session context in a frozen object carried in a request header, which also carries " +
            "server-side policy the agent can't forge.",
          "Auto-registering toolsets and shared dbt lineage tools, with docstrings written for " +
            "the LLM as the reader.",
          "An LLM-in-the-loop harness that boots the real MCP server and has an agent drive " +
            "natural-language tasks end to end.",
          "Structured MCP logging with session and tool ids carried in context variables.",
        ],
      },
    ],
    tech: ["Python", "MCP", "FastMCP", "Claude", "AWS Bedrock", "dbt"],
    links: [],
  },
  {
    id: "zingle/agent-sandbox",
    title: "Agent Sandbox and Enterprise Security",
    waypoint: "Waypoint 7 · the locked garage",
    headline: "6 servers hardened",
    tagline: "Safe AI agent execution and enterprise login on shared infrastructure",
    art: "agent-sandbox",
    period: "Jul – Oct 2026",
    facts: [
      { label: "Coverage", value: "Every agent type, all 6 servers" },
      { label: "Tests", value: "270 sandbox test functions" },
      { label: "SSO adoption", value: "~50% of organisations" },
      { label: "Auth delivery", value: "SSO, magic link, SCIM in 4 days" },
    ],
    body: [
      {
        kind: "p",
        text:
          "AI agents run real read, write and shell tools inside per-session git workspaces on " +
          "shared, multi-tenant infrastructure. I built a fail-closed, parser-based shell and " +
          "filesystem sandbox with OS-level secret isolation, and rolled it out to every agent " +
          "type and all 6 server processes. It blocked a real attempt by a customer user to read " +
          "the platform's source through an agent.",
      },
      {
        kind: "list",
        items: [
          "Three layers: per-agent tool visibility, a workspace jail with a fail-closed tool " +
            "allowlist, and OS-level process hardening.",
          "A hand-written, quote-aware shell tokenizer and a getopt_long-faithful option parser; " +
            "syntax it can't follow is refused.",
          "Environment allowlists on every child process, and servers that refuse to start if " +
            "they can't harden themselves.",
          "CI grep gates that fail the build if a new spawn site bypasses the hardening.",
          "Co-led enterprise login in a four-day push: OIDC SSO, race-safe single-use magic " +
            "links and a full SCIM 2.0 user API for SOC 2.",
        ],
      },
    ],
    tech: ["Python", "Claude Agent SDK", "Linux", "OIDC", "SCIM 2.0", "pytest"],
    links: [],
  },
  {
    id: "zingle/data-foundation",
    title: "Multi-Environment Data Model",
    waypoint: "Waypoint 8 · the chassis",
    headline: "Prod is read-only",
    tagline: "The core data model and warehouse layer every feature is keyed on",
    art: "data-foundation",
    period: "Jun – Nov 2026",
    facts: [
      { label: "Reach", value: "Keyed on in 276 source files" },
      { label: "Warehouses", value: "Snowflake, Postgres, Spark" },
      { label: "Safety", value: "Production targets are read-only" },
      { label: "Migration", value: "Expand → backfill → contract" },
    ],
    body: [
      {
        kind: "p",
        text:
          "The platform tied each dbt repo to a single warehouse connection, so dev, staging and " +
          "prod could not differ. I rebuilt the core data model around dbt environments, ran the " +
          "three-phase migration on production myself, and made production warehouses " +
          "structurally write-proof for AI agents. Every later feature, from optimisation to " +
          "blue-green, is keyed on this model.",
      },
      {
        kind: "list",
        items: [
          "A fail-closed SQL classifier and two layers of guards: anything not provably a read " +
            "is refused on production.",
          "Invariants enforced in Postgres: a partial unique index, and a trigger serialised by " +
            "an advisory lock.",
          "One async, capability-based warehouse layer for Snowflake, Postgres and Spark, with " +
            "timeouts, pooling and 19 capability interfaces.",
          "A bounded, fault-isolated enrichment pipeline that collects row counts, sizes, costs " +
            "and column profiles without overloading customer warehouses.",
          "Database-owned activity tracking through deferred triggers on 25 parent edges, adding " +
            "just 0.18 ms to a chat turn.",
        ],
      },
    ],
    tech: ["PostgreSQL", "SQLAlchemy", "Alembic", "sqlglot", "Snowflake", "Spark"],
    links: [],
  },
  {
    id: "zingle/production-reliability",
    title: "Production Reliability",
    waypoint: "Waypoint 9 · the pit crew",
    headline: "Zero recurrences",
    tagline: "Layered fixes and patterns that keep a multi-tenant platform steady",
    art: "production-reliability",
    period: "May – Oct 2026",
    facts: [
      { label: "Pattern adoption", value: "106 request handlers" },
      { label: "RCAs", value: "2 formal write-ups" },
      { label: "Recurrences", value: "Zero since the fixes" },
    ],
    body: [
      {
        kind: "p",
        text:
          "I took ownership of the platform's quietest failure modes end to end. I wrote two " +
          "formal RCAs, traced root causes down to the container runtime and kernel pipe " +
          "buffers, and shipped layered fixes that became team-wide patterns. Neither issue has " +
          "recurred since.",
      },
      {
        kind: "list",
        items: [
          "Query admission control, bounded fetches through streaming server-side cursors, and " +
            "an idle-only memory watchdog.",
          "A non-blocking log handler plus container ring-buffer logging, so logging can never " +
            "stall a service.",
          "A request-transaction pattern that owns commit and rollback and runs background work " +
            "only after commit, now on 106 handlers.",
          "Resumable agent streams with per-session replay buffers, so agent turns survive a " +
            "page reload.",
          "Worker-loss recovery through a guarded, single-winner update that reaps stalled work.",
        ],
      },
    ],
    tech: ["Python", "asyncio", "FastAPI", "PostgreSQL", "Docker", "Linux"],
    links: [],
  },
  {
    id: "zingle/engineering-standards",
    title: "Engineering Standards and Code Review",
    waypoint: "Waypoint 10 · the rulebook",
    headline: "47 PRs reviewed",
    tagline: "The backend review gate and main author of the team's rulebook",
    art: "engineering-standards",
    period: "May – Nov 2026",
    facts: [
      { label: "Reviews", value: "47 PRs from 6 engineers" },
      { label: "Rulebook", value: "59.3% of 4,522 lines" },
      { label: "Test code", value: "1.41× the product code" },
      { label: "Test harnesses", value: "3 shared" },
    ],
    body: [
      {
        kind: "p",
        text:
          "From my first day I have been the team's backend review gate, and I am the main " +
          "author of the written rulebook that both engineers and their AI coding agents follow. " +
          "I usually add a rule in the same commit as the feature that motivated it, and my " +
          "reviews cite it by name.",
      },
      {
        kind: "list",
        items: [
          "Reviewed 47 merged PRs from 6 engineers with 94 inline comments, using a fixed " +
            "structure and my own pre-merge-review AI skill.",
          "Caught bugs before merge, such as a column-case mismatch that would have let a " +
            "migration diff compare nothing.",
          "Wrote 59.3% of the rulebook, covering locking, tenant isolation, background work and " +
            "API design.",
          "Built 3 shared test harnesses: an agent-driven MCP harness, a golden-SQL harness per " +
            "warehouse and migration-test helpers.",
          "Wrote 1.41× more test code than product code, and a design-doc set before nearly " +
            "every major initiative.",
        ],
      },
    ],
    tech: ["GitHub", "pytest", "AGENTS.md", "Claude Code", "PostgreSQL"],
    links: [],
  },
];
