/**
 * The Expresso route: a café menu of the C++ libraries I wrote to build a web stack from scratch.
 * Content is drawn from the READMEs under references/projects/coding-cpp/.
 */

import type { Stop } from "./types";

export interface CafeStop extends Stop {
  /** The drink this library is served as on the café menu. */
  drink: string;
}

export const EXPRESSO_INTRO =
  "Expresso is a web stack I wrote from scratch in C++: an Express.js-style framework plus seven " +
  "small libraries for JSON, HTTP, ZIP, threading, logging, utilities and email, each in its own " +
  "repository and shared across the ecosystem as git submodules.";

const ORG = "https://github.com/coding-cpp";

export const EXPRESSO_STOPS: CafeStop[] = [
  {
    id: "expresso/expresso",
    title: "Expresso",
    drink: "single-origin espresso",
    tagline: "An Express.js-style web framework for modern C++",
    art: "expresso",
    facts: [
      { label: "Language", value: "C++20" },
      { label: "Dependencies", value: "None outside the in-house libraries" },
      { label: "Docker pulls", value: "28,000+" },
      { label: "History", value: "300 commits, 68 merged PRs" },
    ],
    body: [
      {
        kind: "p",
        text:
          "I built Expresso so that writing a C++ backend feels like writing Express.js: " +
          'app.get("/health", handler), app.use(middleware), nested routers and chainable ' +
          "responses. Under that API is my own HTTP/1.1 server on raw POSIX sockets, driven by a " +
          "reactor event loop. Every supporting piece is one of my own libraries, pulled in as a " +
          "submodule.",
      },
      {
        kind: "list",
        items: [
          "Non-blocking I/O: one event-loop thread on epoll (Linux) or kqueue (macOS), with " +
            "handlers running on the nexus thread pool and a self-pipe handing responses back.",
          "Zero-copy static file serving with sendfile, plus HTTP Range support so audio and " +
            "video can be scrubbed in the browser.",
          "Multi-file ZIP downloads streamed over chunked transfer encoding with Zippuccino, and " +
            "CRC32-based ETags for every file served.",
          "Built-in CORS, cookie parsing, caching and static-serve middleware, with a simple " +
            "base class for custom middleware.",
          "Statically linked into a FROM scratch Docker image, with CI publishing multi-arch " +
            "builds and a benchmark suite comparing it with Node, Express, Bun and Deno.",
        ],
      },
    ],
    tech: ["C++20", "POSIX sockets", "epoll / kqueue", "CMake", "Docker", "GitHub Actions"],
    links: [
      { label: "GitHub", href: `${ORG}/expresso`, kind: "github" },
      { label: "Live demo", href: "https://expresso.aditjain.me", kind: "live" },
      { label: "Docker Hub", href: "https://hub.docker.com/r/jadit19/expresso", kind: "docker" },
    ],
  },
  {
    id: "expresso/json",
    title: "JSON",
    drink: "cold brew, served neat",
    tagline: "A JSON parser and dynamic object type for C++",
    art: "json",
    facts: [
      { label: "Language", value: "C++17" },
      { label: "Parser", value: "Hand-written recursive descent" },
      { label: "Used by", value: "Expresso, mochios" },
    ],
    body: [
      {
        kind: "p",
        text:
          "I wrote this JSON library so working with JSON in C++ feels like using a Python dict or " +
          'a JavaScript object: person["links"]["github"] = "..." just works, and values convert ' +
          "back to native types implicitly. It parses request bodies and powers res.json() in " +
          "Expresso, and parses JSON responses in mochios.",
      },
      {
        kind: "list",
        items: [
          "A recursive-descent parser written from scratch, loading from a string or a file.",
          "A single json::object type backed by std::variant for scalars, with vectors for " +
            "arrays and maps for objects.",
          "Auto-vivification: indexing an empty value creates an object or array, and arrays " +
            "grow when written past the end.",
          "Pretty printing with configurable indentation and deterministic, sorted key order.",
          "Integers and floats kept distinct, and escape-aware string parsing.",
        ],
      },
    ],
    tech: ["C++17", "std::variant", "Parsing", "CMake"],
    links: [{ label: "GitHub", href: `${ORG}/json`, kind: "github" }],
  },
  {
    id: "expresso/brewtils",
    title: "Brewtils",
    drink: "filter kaapi, steel tumbler",
    tagline: "A dependency-free utility library for modern C++",
    art: "brewtils",
    facts: [
      { label: "Language", value: "C++17" },
      { label: "Modules", value: "10" },
      { label: "Used by", value: "Expresso, Zippuccino, mochios, Bloomail" },
    ],
    body: [
      {
        kind: "p",
        text:
          "Brewtils is the shared foundation of the ecosystem: the low-level helpers every other " +
          "library needs, in clean nested namespaces. I grew it out of Expresso's early utility " +
          "code and turned it into a standalone library so the framework, the ZIP writer, the " +
          "HTTP client and the mail library could all share it.",
      },
      {
        kind: "list",
        items: [
          "Base64 encoding and decoding written from scratch with bit manipulation.",
          "UUID v4 and name-based v5 generation with correct version and variant bits.",
          "A .env loader with comments, trimming and default values.",
          "MIME detection for static file serving and a recursive directory walker used to zip " +
            "whole folders.",
          "HTTP date formatting, socket wrappers and a signal handler for clean shutdown in " +
            "Docker.",
        ],
      },
    ],
    tech: ["C++17", "std::filesystem", "POSIX", "CMake", "Docker"],
    links: [{ label: "GitHub", href: `${ORG}/brewtils`, kind: "github" }],
  },
  {
    id: "expresso/mochios",
    title: "Mochios",
    drink: "café mocha",
    tagline: "An axios-inspired HTTP client for C++",
    art: "mochios",
    facts: [
      { label: "Language", value: "C++17" },
      { label: "Transport", value: "POSIX sockets" },
      { label: "Shares models with", value: "Expresso" },
    ],
    body: [
      {
        kind: "p",
        text:
          "I built Mochios to bring axios-style ergonomics to C++: configure a client, register " +
          "interceptors and call get, post, put and the rest. Its request and response classes " +
          "are also the base classes of Expresso's own, so my server and client share one HTTP " +
          "message model.",
      },
      {
        kind: "list",
        items: [
          "An HTTP/1.1 client written from scratch over BSD sockets.",
          "A generic, type-safe interceptor pipeline for requests and responses, ordered so " +
            "user hooks always see a parsed JSON body.",
          "Built-in interceptors for User-Agent, cookies and automatic JSON parsing.",
          "Non-blocking connect with timeouts, and timeouts or failures returned as well-formed " +
            "408 and 500 responses.",
          "Full Set-Cookie parsing, including Secure, HttpOnly, Partitioned and SameSite.",
        ],
      },
    ],
    tech: ["C++17", "HTTP/1.1", "POSIX sockets", "Templates", "GitHub Actions"],
    links: [{ label: "GitHub", href: `${ORG}/mochios`, kind: "github" }],
  },
  {
    id: "expresso/zippuccino",
    title: "Zippuccino",
    drink: "cappuccino, extra foam",
    tagline: "A streaming ZIP archive writer for C++, built byte by byte",
    art: "zippuccino",
    facts: [
      { label: "Language", value: "C++17" },
      { label: "Format", value: "PKZIP, implemented by hand" },
      { label: "Used by", value: "Expresso" },
    ],
    body: [
      {
        kind: "p",
        text:
          "I wrote Zippuccino to understand how ZIP actually works, so it writes every header " +
          "field of the format itself and computes its own CRC32. Its streaming API is what lets " +
          "Expresso send a folder as a ZIP download without building the archive in memory, and " +
          "Expresso reuses its CRC32 for ETags.",
      },
      {
        kind: "list",
        items: [
          "Local file headers, central directory and end-of-central-directory record written " +
            "field by field.",
          "A table-driven CRC32 with a lazily built lookup table, reading files in 4 KB buffers.",
          "A pull-based streaming API: the caller decides where each header and file goes, " +
            "whether a file, a socket or an HTTP chunk.",
          "Exact archive size prediction before any bytes are written.",
          "Recursive folder zipping that keeps relative paths, built on Brewtils.",
        ],
      },
    ],
    tech: ["C++17", "ZIP format", "CRC32", "Binary I/O", "CMake"],
    links: [{ label: "GitHub", href: `${ORG}/zippuccino`, kind: "github" }],
  },
  {
    id: "expresso/logger",
    title: "logger",
    drink: "black coffee, no sugar",
    tagline: "A lightweight, colourised logging library for C++",
    art: "logger",
    facts: [
      { label: "Language", value: "C++17" },
      { label: "Dependencies", value: "Standard library only" },
      { label: "Used by", value: "8 repositories in the org" },
    ],
    body: [
      {
        kind: "p",
        text:
          "logger is the base layer of the whole ecosystem: every other library, including " +
          "Expresso, includes it as a submodule. I kept it deliberately small, as free functions " +
          "with one include, and gave it one key idea: logger::error can log and throw in a " +
          "single call.",
      },
      {
        kind: "list",
        items: [
          "Five colour-coded levels with timestamps and aligned tags; errors go to stderr.",
          "A log-and-throw error API that behaves the same whether logging is on or off.",
          "Flushes on every call, so logs show up immediately in docker logs.",
          "Runtime settings for enabling output, colours, timestamps and time format.",
        ],
      },
    ],
    tech: ["C++17", "ANSI colours", "Error handling", "CMake"],
    links: [{ label: "GitHub", href: `${ORG}/logger`, kind: "github" }],
  },
  {
    id: "expresso/nexus",
    title: "nexus",
    drink: "affogato",
    tagline: "A compact thread pool and async helper for C++",
    art: "nexus",
    facts: [
      { label: "Language", value: "C++17" },
      { label: "Dependencies", value: "Standard library and logger" },
      { label: "Used by", value: "Expresso" },
    ],
    body: [
      {
        kind: "p",
        text:
          "nexus is the concurrency engine inside Expresso: the server's request handlers run on " +
          "its thread pool. I designed it around one generic enqueue that takes any callable and " +
          "hands back a typed std::future, in about 100 lines of library code.",
      },
      {
        kind: "list",
        items: [
          "Type-safe task submission: return types deduced with std::invoke_result and wrapped " +
            "in a std::packaged_task.",
          "Type erasure that lets one std::function<void()> queue run tasks of any signature.",
          "Classic mutex and condition-variable design; tasks never run while the lock is held.",
          "Graceful shutdown that runs every queued task before the pool is destroyed.",
          "Pool size defaults to the machine's hardware concurrency.",
        ],
      },
    ],
    tech: ["C++17", "Concurrency", "std::future", "Templates", "CMake"],
    links: [{ label: "GitHub", href: `${ORG}/nexus`, kind: "github" }],
  },
  {
    id: "expresso/bloomail",
    title: "Bloomail",
    drink: "iced latte",
    tagline: "A from-scratch SMTP mail library for modern C++",
    art: "bloomail",
    facts: [
      { label: "Language", value: "C++20" },
      { label: "Protocol", value: "SMTP with STARTTLS" },
      { label: "Built on", value: "Brewtils, logger, OpenSSL" },
    ],
    body: [
      {
        kind: "p",
        text:
          "Instead of wrapping a mail SDK, I wrote Bloomail to speak SMTP directly: it opens the " +
          "socket, upgrades to TLS in place, authenticates and streams a hand-built MIME message " +
          "with attachments. It uses Brewtils for base64 and MIME types and logger for its debug " +
          "transcripts.",
      },
      {
        kind: "list",
        items: [
          "In-place TLS upgrade with STARTTLS and OpenSSL on the same socket.",
          "Attachments streamed in 57-byte chunks, which base64-encode to exactly one 76-character " +
            "MIME line, so memory use stays flat for any file size.",
          "MIME multipart messages with To, Cc and Bcc, keeping Bcc out of visible headers.",
          "A fluent, chainable API and a layered client design where a new provider, like the " +
            "included Gmail client, is one constructor.",
          "A debug mode that logs every command and reply, tagged TCP or TLS.",
        ],
      },
    ],
    tech: ["C++20", "SMTP", "OpenSSL", "MIME", "POSIX sockets"],
    links: [{ label: "GitHub", href: `${ORG}/bloomail`, kind: "github" }],
  },
];
