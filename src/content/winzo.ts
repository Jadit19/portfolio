/**
 * The WinZO route: a pit board of the payments, wallet and subscription systems I built at WinZO.
 * Content is drawn from the case studies under references/work/winzo/.
 */

import type { Stop } from "./types";

export interface PitStop extends Stop {
  /** The pit-board line under the title, e.g. "Sector 2 · payments risk" (≤ 40 chars). */
  sector: string;
  /** The headline number flashed on the LED board, e.g. "−73% chargebacks" (≤ 18 chars). */
  headline: string;
}

export const WINZO_INTRO =
  "At WinZO, a real-money gaming platform with 10M+ daily active users, I joined as an SDE-1 and " +
  "was promoted to SDE-2 in January 2026. I owned five payment, wallet and subscription services " +
  "end to end, handling ~500K requests a minute over 20TB+ of PostgreSQL.";

export const WINZO_STOPS: PitStop[] = [
  {
    id: "winzo/payments-risk-engine",
    title: "Real-time Payments Risk Engine",
    sector: "Sector 1 · payments risk",
    headline: "−73% chargebacks",
    tagline: "Every risky pay-in checked between authorization and capture",
    art: "payments-risk-engine",
    role: "Owned, built from scratch",
    facts: [
      { label: "Impact", value: "−73% chargebacks and fraud exposure in 6 months" },
      { label: "Risk categories", value: "15, ordered per market and method" },
      { label: "Decisions", value: "Capture, void or email-OTP step-up" },
      { label: "Integrations", value: "4 gateway flows share one engine" },
    ],
    body: [
      {
        kind: "p",
        text:
          "I built WinZO's payments risk engine from scratch. It sees across gateways and across " +
          "users, which no single gateway can, and decides in the moment between authorization " +
          "and capture. Together with the refund pipeline, it cut chargebacks and fraud exposure " +
          "by 73% over six months.",
      },
      {
        kind: "list",
        items: [
          "15 config-driven risk categories, evaluated in a priority order set per market and " +
            "payment method, so new rules ship without a deploy.",
          "Cross-user signals such as the same card or PayPal account on several users, method " +
            "churn and blacklisted methods.",
          "A self-learning loop: every gateway fraud or dispute webhook hardens the checks for " +
            "every other user.",
          "Slower actions run as retried, Redis-locked background jobs: blocking a method or " +
            "account, or routing a user to a forced refund.",
          "Safe by design: the engine fails open to capture, so it never takes down the payment " +
            "path.",
        ],
      },
    ],
    tech: ["TypeScript", "PostgreSQL", "Redis", "Bull", "OpenTelemetry"],
    links: [],
  },
  {
    id: "winzo/zopass-subscriptions",
    title: "ZoPass Subscription Microservice",
    sector: "Sector 2 · subscriptions",
    headline: "+6% month-on-month",
    tagline: "A live subscription product moved out of the wallet monolith",
    art: "zopass-subscriptions",
    period: "Sep 2025 – Mar 2026",
    role: "Co-led",
    facts: [
      { label: "Migration", value: "Zero downtime, money in flight throughout" },
      { label: "Paywall impact", value: "6% month-on-month mandate revenue growth" },
      { label: "Billing", value: "UPI autopay mandates" },
    ],
    body: [
      {
        kind: "p",
        text:
          "I co-led the extraction of ZoPass, WinZO's paid subscription pass, out of the wallet " +
          "monolith into its own microservice, one API at a time, while recurring debits, " +
          "mandates and refunds kept flowing. I then built most of the subsystems inside it. My " +
          "paywall work drove 6% month-on-month growth in mandate revenue.",
      },
      {
        kind: "list",
        items: [
          "A strangler migration: per-API rollout flags, a shared database with no data move, " +
            "and rollback as a simple flag flip.",
          "An idempotent rewards engine with deterministic payment and job IDs, so the same " +
            "credit can never be queued twice.",
          "Pause, resume, cancel and tiered refunds as automated, self-healing workflows, with " +
            "crons that re-drive any stuck work.",
          "A fully config-driven paywall: plans per user segment, A/B card designs and " +
            "localized assets.",
          "The UPI autopay mandate lifecycle behind it for PhonePe, Cashfree and Razorpay: " +
            "create, pre-notify, debit, status sync and cancel.",
        ],
      },
    ],
    tech: ["TypeScript", "Express", "PostgreSQL", "Redis Cluster", "Bull", "Kafka"],
    links: [],
  },
  {
    id: "winzo/offer-engine",
    title: "Offer Engine and Checkout Pricing",
    sector: "Sector 3 · checkout pricing",
    headline: "−20% p95 latency",
    tagline: "Contest-entry pricing rebuilt across three services",
    art: "offer-engine",
    role: "Owned these features",
    facts: [
      { label: "Impact", value: "−20% p95 latency on offer computation" },
      { label: "Services", value: "Offers, wallet and BFF" },
      { label: "New offers", value: "Personalized, packs, multi-use coupons" },
    ],
    body: [
      {
        kind: "p",
        text:
          "I redesigned how a contest entry is priced across three microservices, which cut p95 " +
          "latency by 20% on one of the busiest screens in the app. I also added personalized " +
          "offers, offer packs and multi-use coupons to the offers engine.",
      },
      {
        kind: "list",
        items: [
          "Offers and fees fetched in parallel, then one wallet call on the already-discounted " +
            "amounts.",
          "An opaque offer token, so the user pays exactly the offers they were shown.",
          "A rule language for marketing that turns a user's recent spending into a personal " +
            "offer tier, with no code change.",
          "A two-level cache with cross-pod invalidation, and lag-aware routing to read replicas.",
          "Circuit breakers with fallback responses on outbound calls, with their state exported " +
            "as metrics.",
        ],
      },
    ],
    tech: ["TypeScript", "PostgreSQL", "Redis", "Kafka", "Circuit breakers"],
    links: [],
  },
  {
    id: "winzo/data-platform",
    title: "Partition Cleanup and Batch Compute",
    sector: "Sector 4 · data platform",
    headline: "−17% infra cost",
    tagline: "Keeping 20TB+ of transaction data fast and affordable",
    art: "data-platform",
    role: "Owned",
    facts: [
      { label: "Infra cost", value: "−17%" },
      { label: "Queries", value: "~30% faster on PostgreSQL" },
      { label: "Data", value: "20TB+ of transaction tables" },
      { label: "Compute", value: "AWS Batch, scales to zero" },
    ],
    body: [
      {
        kind: "p",
        text:
          "I built and extended the partition cleanup and archival work on WinZO's transaction " +
          "tables. It cut infra cost by 17% and made PostgreSQL queries about 30% faster. I also " +
          "moved long-running jobs onto scale-to-zero AWS Batch compute.",
      },
      {
        kind: "list",
        items: [
          "Partition migrations that pre-create future ranges and remove catch-all default " +
            "partitions.",
          "A resumable, cursor-based read/write cleanup worker that safely drains in-flight rows " +
            "out of old partitions.",
          "Old partitions archived before they are dropped, so cleanup stays audit-safe.",
          "Crash-resumable file ingestion from S3 with range reads and constant memory.",
          "Terraform for Graviton Batch capacity, plus self-service Jenkins jobs for operations.",
        ],
      },
    ],
    tech: ["PostgreSQL", "AWS Batch", "S3", "Terraform", "Jenkins", "Bull"],
    links: [],
  },
  {
    id: "winzo/fraud-ml-platform",
    title: "Fraud ML Platform",
    sector: "Sector 5 · fraud ML",
    headline: "2 CatBoost models",
    tagline: "ML fraud scores turned into enforcement at signup and withdrawal",
    art: "fraud-ml-platform",
    role: "Owned the engineering",
    facts: [
      { label: "Models", value: "Signup and withdrawal risk" },
      { label: "Output", value: "0–10 score with top-3 SHAP reasons" },
      { label: "Services", value: "TypeScript orchestrator, Python scorer" },
    ],
    body: [
      {
        kind: "p",
        text:
          "I built the serving and decisioning platform for WinZO's fraud models, which the " +
          "data-science team trained. Scoring runs asynchronously, so signup and withdrawal stay " +
          "fast, and every decision is explainable and auditable.",
      },
      {
        kind: "list",
        items: [
          "A fire-and-forget trigger, score and callback loop between a TypeScript risk service " +
            "and a FastAPI model server.",
          "Two CatBoost models serving a 0–10 risk score with the top three SHAP explanations.",
          "Config-driven policy bands that change enforcement without a deploy.",
          "Every evaluation and action persisted for a full audit trail, with actions isolated " +
            "so one failure never stops another.",
          "Withdrawal fraud checks alongside it: rolling-window velocity counts, graduated " +
            "outcomes and voice-OTP step-up.",
        ],
      },
    ],
    tech: ["Python", "FastAPI", "CatBoost", "SHAP", "TypeScript", "PostgreSQL"],
    links: [],
  },
  {
    id: "winzo/international-payments",
    title: "International Payments",
    sector: "Sector 6 · new markets",
    headline: "New markets opened",
    tagline: "The gateway stack that took WinZO payments to new markets",
    art: "international-payments",
    role: "Owned / major contributor",
    facts: [
      { label: "Pay-ins", value: "Inai, Juspay, Checkout.com, PayPal" },
      { label: "Payouts", value: "MassPay, Inai, Juspay" },
      { label: "Contract", value: "Authorize, risk-check, capture" },
    ],
    body: [
      {
        kind: "p",
        text:
          "I built the payment stack that launched WinZO in new international markets. I owned " +
          "the Inai integration, built most of the Juspay and Checkout.com integrations, and " +
          "owned PayPal refunds, disputes, vaulting and international payouts.",
      },
      {
        kind: "list",
        items: [
          "One pay-in contract for every gateway, so a single risk engine protects all of them.",
          "Vaulted, one-click PayPal payments with self-refreshing OAuth tokens.",
          "An account-verification ladder that upgrades risky payers through email OTP instead " +
            "of declining them.",
          "Signature-verified webhooks, and orchestrator-aware mapping so later webhooks always " +
            "find the original payment.",
          "International payouts behind one interface, with duplicate-beneficiary detection.",
        ],
      },
    ],
    tech: ["TypeScript", "PostgreSQL", "Redis", "OAuth 2.0", "HMAC webhooks"],
    links: [],
  },
  {
    id: "winzo/guest-sso-login",
    title: "Guest and SSO Login",
    sector: "Sector 7 · onboarding",
    headline: "No gap in billing",
    tagline: "Play first, register later, keep everything you paid for",
    art: "guest-sso-login",
    role: "Owned",
    facts: [
      { label: "Migration", value: "Idempotent, across 4 services" },
      { label: "Carried over", value: "Passes, UPI mandates, payment history" },
      { label: "Gating", value: "Config-driven per trigger source" },
    ],
    body: [
      {
        kind: "p",
        text:
          "I let users play before sharing a mobile number, with safe, config-driven limits in " +
          "the wallet. When a guest registers, one idempotent migration across four services " +
          "moves their subscriptions, mandates and payment history to the new account, with no " +
          "gap in billing or rewards.",
      },
      {
        kind: "list",
        items: [
          "Guest gating for add cash, withdrawals and contest pricing, with upgrade prompts in " +
            "the app.",
          "An account-switch migration driven by Kafka, with every step safe to replay.",
          "Remaining paid time added to the new pass when two passes meet, so users never lose " +
            "time they paid for.",
          "Redirect pointers that keep in-flight debits, rewards and webhooks flowing to the new " +
            "account.",
        ],
      },
    ],
    tech: ["TypeScript", "Kafka", "PostgreSQL", "Redis", "OpenTelemetry"],
    links: [],
  },
  {
    id: "winzo/refund-orchestration",
    title: "Refund Orchestration",
    sector: "Sector 8 · refunds",
    headline: "5 refund guards",
    tagline: "One refund pipeline for every gateway and every caller",
    art: "refund-orchestration",
    role: "Owned",
    facts: [
      { label: "Guards", value: "5 independent over-refund checks" },
      { label: "Callers", value: "Wallet, subscriptions, back office, payouts" },
      { label: "Impact", value: "Part of the −73% chargeback cut" },
    ],
    body: [
      {
        kind: "p",
        text:
          "I unified refunds into one gateway-agnostic pipeline used by the wallet, ZoPass " +
          "cancellations, the back office and withdrawal-as-refund. It is also how the risk " +
          "engine refunds automatically, and together they cut chargebacks and fraud exposure by " +
          "73% over six months.",
      },
      {
        kind: "list",
        items: [
          "Five independent guards: a per-transaction lock, precision rounding, parent " +
            "validation, unique refund IDs and a cumulative cap.",
          "Gateway-specific code reduced to one thin adapter per gateway.",
          "Race-safe completion with row locks, and failed webhooks persisted and replayed.",
          "One status path shared by webhooks, polls and admin syncs, applying only real " +
            "transitions.",
        ],
      },
    ],
    tech: ["TypeScript", "PostgreSQL", "Redis", "Bull"],
    links: [],
  },
];
