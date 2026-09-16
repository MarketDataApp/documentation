---
title: BYOK Compliance Audit Prompt
description: The prompt we give Claude or Codex to audit a repository against the BYOK model and the Market Data data policies, and to return a GO or NO-GO report.
hide_table_of_contents: false
sidebar_position: 3
---

This page holds one prompt. Paste it into Claude Code or Codex, point the agent at
a repository, and it returns an auditor's report with a **GO** or **NO-GO** verdict
on whether the application complies with the BYOK model and our data policies.

Use it for three jobs:

- The annual BYOK review promised in the public guide.
- A pre-launch review, when a developer asks us to confirm a design.
- Our own review of a customer repository during a support or sales thread.

## The policies the prompt audits against

The prompt carries the rules inline, so an agent with no network access can still
run it. These pages are the source of truth, and the prompt must be updated when
one of them changes.

| Source                                                                                   | What it supplies                                                  |
|------------------------------------------------------------------------------------------|-------------------------------------------------------------------|
| [Bring Your Own Key](https://www.marketdata.app/education/licensing/bring-your-own-key/) | the possession rule, the architecture table, the launch checklist |
| [Data Redistribution Policy](/docs/account/data-policies/data-redistribution/)           | what counts as redistribution                                     |
| [Single IP Address Policy](/docs/account/data-policies/single-ip/)                       | one key, one IP, and the five-minute block                        |
| [Professional Status Policy](/docs/account/data-policies/professional-status/)           | self-service plans are non-professional only                      |
| [Free and Trial Account Data Policy](/docs/account/data-policies/free-accounts/)         | what a free key returns                                           |
| [Account Verification Policy](/docs/account/data-policies/account-verification/)         | the one-business-day verification step                            |
| [Exchange Agreements](/docs/account/data-policies/exchange-agreements/)                  | UTP, OPRA and IEX subscriber agreements                           |

## How to run it

Clone the repository under review, then start the agent in it:

```bash
git clone <repo-url> audit-target
cd audit-target
claude
```

Paste the prompt. Replace the two bracketed values on the first line. The agent
writes the report to `BYOK-AUDIT.md` in the working directory.

Codex takes the same text. Run it at the highest reasoning effort, because the
decisive work is tracing a runtime boundary rather than matching a pattern.

## Three things the prompt does on purpose

**It refuses to guess.** A finding without a `file:line` citation is not a
finding. A question the repository cannot answer becomes an
`INSUFFICIENT EVIDENCE` verdict, not an optimistic GO. An auditor cannot certify
what the auditor cannot see.

**It never grades its own conclusion.** The prompt ends with a second pass that
starts from a fresh context and attacks the verdict. A GO that survives an
attempt to break it is worth more than a GO the author agreed with.

**It separates severity from the verdict.** Only a P1 finding moves the verdict.
P2 findings are required fixes with a deadline, and they never turn a GO into a
NO-GO. This keeps the verdict readable and stops a long list of small items from
reading as a failure.

## The prompt

````
You are an independent compliance auditor. Audit the repository at [REPO PATH]
against the Market Data BYOK model and the Market Data data policies. Write your
report to BYOK-AUDIT.md. The application under audit is [APP NAME].

Your report decides whether this application may ship on a BYOK basis. A wrong
GO exposes Market Data to an exchange audit and exposes the developer to
retroactive fees. A wrong NO-GO blocks a legitimate product. Be exact, and be
willing to say you do not know.

## The one rule

BYOK works because the data never reaches the developer. Market data must travel
from api.marketdata.app to the end user's device, and it must be processed on
that device. It must not pass through infrastructure the developer controls.

If a server the developer controls sits anywhere in the path, the developer has
taken possession, and possession makes the developer a redistributor. None of
the following change that answer:

- the request used the end user's own API key
- the server stored the response against one user and never shared it
- the server only cached, only relayed, or only reformatted the response
- the server never showed the raw data, only a derived value
- the developer never charged for the data

Judge where the code RUNS, not where the file sits. A fetch call in a shared
module proves nothing on its own. Find the entry point that reaches it.

## House rules for this audit

1. Every finding cites evidence as `path/to/file.ext:LINE` and quotes the code.
   No citation, no finding.
2. Report what the code does. Do not report what you assume the developer meant.
3. When the repository cannot answer a question, record the question. Do not
   resolve it in the developer's favour, and do not resolve it against them.
4. Do not soften a P1. Do not inflate a P2 to look thorough.
5. Read configuration and deployment files as evidence of runtime, equal in
   weight to source code.
6. You choose how to search. The seeds below are a starting point, not a
   checklist, and finding nothing in them proves nothing.

## Work in this order

**Step 1 — Establish the shape.** Decide what this application is: a desktop
app, a mobile app, a browser application, a plugin inside a trading platform, a
server application, or a mix. Record how you decided. A server application is a
near-certain NO-GO, so identify one early.

**Step 2 — Map the runtime boundary.** List every process this project starts
and say, for each one, whose machine runs it: the end user's, or the
developer's. Server-side runtimes are easy to miss. Look for:

- backend route handlers, controllers, and middleware
- serverless functions, edge functions, and workers
- `'use server'` directives, server components, server actions, loaders
- Dockerfile, docker-compose, Kubernetes manifests, Procfile, fly.toml,
  vercel.json, netlify.toml, wrangler.toml, serverless.yml, app.yaml
- cron entries, scheduled jobs, task queues, message consumers
- GitHub Actions or other CI jobs with a `schedule` trigger
- push-notification senders and alerting services

**Step 3 — Trace the data path.** Find every call site that reaches
api.marketdata.app. For each one, answer three questions: which process issues
the request, which process receives the response, and where the response is
stored or computed on. This trace is the decisive section of your report. Write
it out even when the answer is obvious.

**Step 4 — Apply the rules below.** Each rule gets a verdict: PASS, FAIL,
or UNRESOLVED.

**Step 5 — Disprove your own verdict.** See the last section.

## The rules

### Group A — Possession of the data (all P1)

| ID | The rule |
|----|----------|
| A1 | Every market data request originates on the end user's device. |
| A2 | No server the developer controls receives, relays, proxies, or terminates a market data response. A server that calls the API with the end user's own key still fails this rule. |
| A3 | No market data, and no value derived from market data, is written to storage the developer controls. This covers databases, object storage, caches, logs, and analytics events. |
| A4 | Every calculation on market data runs on the end user's device. |
| A5 | Nothing that touches market data runs while the end user's device is off. Schedulers, cron jobs, queue workers, and background alert services all fail this rule. |
| A6 | No server-side sweep across many symbols. A nightly scan of a symbol universe needs a server, and a server disqualifies the model. |

### Group B — The API key (P1 unless marked)

| ID | The rule |
|----|----------|
| B1 | Each end user supplies their own key. No shared key, no embedded key, no app-wide key, and no fallback key when the user has not entered one. |
| B2 | The key is never transmitted to infrastructure the developer controls, and never written to a log, a crash report, or an analytics event. |
| B3 | No key pooling, no rotation of keys between users, and no request routing that makes several people look like one subscriber. |
| B4 | **P2.** The key rests in the operating system credential store, or encrypted at rest on the device. |
| B5 | **P2.** The end user can replace or remove the key from inside the application. |

### Group C — Export and onward delivery (all P1)

| ID | The rule |
|----|----------|
| C1 | The application does not export market data. This covers writing to a file, copying to the clipboard, saving to a spreadsheet, writing to a database the user can open, and syncing to another program. |
| C2 | The application does not deliver market data onward. This covers exposing an API, a feed, a webhook, a plugin interface, and a scripting hook another program can call. |
| C3 | The purpose of the application is not data export. A tool built to move market data into a spreadsheet, a database, or a file is a redistribution product whatever key it runs on. |
| C4 | No market data, and no derived value, moves from one end user to another. This covers leaderboards, shared watchlists that carry prices, social feeds, and team workspaces. |

### Group D — Seats and account controls (P1 unless marked)

| ID | The rule |
|----|----------|
| D1 | One person, one account, one key. The application builds no multi-seat, team, or shared-login feature on a single key. |
| D2 | Nothing in the application works around the single-IP control. Proxy pools, egress rotation, and a retry that changes source address after a 403 all fail this rule. |
| D3 | **P2.** Development and test accounts are one per person. A single key shared across a team, a CI job, or a test fixture fails this rule. |

### Group E — Request hygiene (all P2)

| ID | The rule |
|----|----------|
| E1 | Every request carries a unique `User-Agent` that names the application and its version. A library default such as `axios/1.6.0`, `python-requests/2.31.0`, or `okhttp/4.12.0` fails this rule. |
| E2 | Option chain requests use `mode=cached` unless the use case needs live data. A live chain costs one credit per contract; a cached chain costs one credit. |
| E3 | Polling intervals fit a credit budget. A free key holds 100 credits a day. State the worst-case daily credit spend you can derive from the code. |
| E4 | The application handles `429`, `402`, and `403` with a message to the user. A `403` is the single-IP control and clears after five minutes with no requests. |

### Group F — Onboarding and entitlement (all P2)

| ID | The rule |
|----|----------|
| F1 | Onboarding tells the user they need a second account, and links to the Market Data sign-up page. |
| F2 | Onboarding explains the verification step and the wait of up to one business day before real-time data arrives. |
| F3 | The application works on a delayed, historical, or quota-limited key, and reads response timestamps rather than assuming the data is live. A missing entitlement raises no error: the API returns the freshest data the user is entitled to. |
| F4 | The application does not assume every user is non-professional. A user our compliance team classifies as professional never receives real-time data on a self-service plan. |

## What is NOT a finding

Do not report these. Each one is a legitimate design.

- A developer backend that carries no market data: authentication, licensing,
  billing, entitlement checks, crash reports, feature flags, software updates.
- A developer backend that stores the user's own input, such as a watchlist of
  symbols, alert thresholds, layout, or preferences. A symbol is not market data.
- Serving the application bundle from a web server. A browser application whose
  server only serves static assets passes A1 and A2.
- Caching or computing inside the client process, including an SDK's own
  in-memory cache. That runs on the user's device.
- Persisting responses and derived values in the application's own storage on
  the user's machine, and drawing them on a chart later. This is allowed, as
  long as nothing exports them.
- Showing raw chains, quotes, and Greeks. The user is entitled to the data, and
  the application does not have to hide it behind derived values.
- Test fixtures, recorded responses, and example code, unless they ship in the
  product or carry a real API key.

## One case that is neither a PASS nor a plain FAIL

A developer server that handles only **historical** data is not BYOK, and it is
also not automatically a violation. The exchanges charge no redistribution fee
for historical data, meaning data from a completed session once the next session
has opened. Delayed data does not qualify.

If you find a server path that carries only historical data, record it as a P1
against A2, and add a note that the product may qualify under the historical-only
model. Recommend that the developer contact Market Data sales rather than
recommending a code change. Say plainly that you cannot grant that model, and
that only Market Data can.

Data becomes historical at the open of the next trading session. A product that
serves the previous session's data at 06:00 Eastern is serving delayed data and
is fee-liable until the bell.

## Search seeds

Start here. Do not stop here.

```
api.marketdata.app
marketdata                       # SDK package names and imports
MARKETDATA_TOKEN                 # and any other token env var
Bearer                           # authorization headers
/v1/options/chain                # and the other endpoints
mode=cached
User-Agent
```

Then search the repository's own vocabulary for each rule group: the name of
its HTTP client, its cache layer, its export feature, its scheduler, and its
storage. A project rarely writes `api.marketdata.app` at every call site.

Read these files in full whenever they exist: the README, the dependency
manifest, every deployment and container file, every CI workflow, and the
application entry points.

## Severity and the verdict

Three severities:

- **P1** — blocking. The application must not ship on BYOK while it stands.
- **P2** — required fix. It does not block the verdict.
- **P3** — advisory. Worth saying, not worth requiring.

The verdict follows from the findings, with no discretion:

| Verdict                    | When |
|----------------------------|------|
| **GO**                     | Zero P1 findings, and zero UNRESOLVED questions of P1 class. |
| **NO-GO**                  | One or more P1 findings. |
| **INSUFFICIENT EVIDENCE**  | Zero P1 findings, but one or more UNRESOLVED questions of P1 class. |

A GO is not permanent. Market Data reviews a BYOK application once a year.

## The report

Write BYOK-AUDIT.md with exactly these sections, in this order.

1. **Verdict.** The single word, on its own line, first. Then two sentences: what
   the application is, and the one fact that decided the verdict.

2. **Scope.** The repository, the commit SHA, the date, and the audit tool. Then
   what you did not review and why: a private submodule, a binary dependency, a
   backend in another repository, generated code you could not read.

3. **Application shape.** What the application is, and the evidence for it.

4. **The data path.** For every call site that reaches the Market Data API: which
   process issues the request, which process receives the response, and where the
   response is stored or computed on. This is the decisive section. Use a table.

5. **Findings.** A table first, one row per finding: ID, rule, severity, file,
   line, one-line summary. Then one block per finding, ordered P1 first, each
   with the rule text, the quoted code, why it fails, and a concrete remediation.
   For a P2, give the date by which it must be fixed.

6. **Unresolved questions.** Each with its rule ID, its class (P1 or P2), what
   you could not determine, and the one thing that would settle it.

7. **Checks that passed.** Every rule ID you tested and found compliant, with the
   evidence. A reader must be able to see what was tested, not only what failed.

8. **Re-audit.** The date of the next annual review, and any change to the
   application that requires an earlier one.

Do not add a summary of your process, and do not add encouragement. This is an
audit report.

## Before you write the verdict: disprove it

Open a fresh context. Give it your draft report, the repository, and one
instruction: **prove this verdict wrong.**

- Against a GO, hunt for the server you missed. Re-read every deployment file
  and every scheduled job, and follow each import chain from a server entry
  point to the end.
- Against a NO-GO, test whether the blocking finding survives. Confirm the code
  ships, confirm it runs on developer infrastructure, and confirm it carries
  market data rather than the user's own input.

Fold what the second pass finds into the report. If it overturns the verdict,
publish the corrected verdict and say in the Scope section that the first pass
was wrong. Do not publish a verdict the second pass did not attack.
````

## What this prompt does not do

It reads a repository. It cannot see a running system, so four things stay
outside its reach, and the report should not be read as covering them:

- **Infrastructure that is not in the repository.** A proxy configured in a
  hosting dashboard leaves no file to find.
- **A binary or closed dependency.** The prompt records these as unresolved
  rather than clearing them.
- **Live request behaviour.** Our own API logs answer this. A `User-Agent` in
  the code and a `User-Agent` on the wire are two claims.
- **Whether the developer follows the report.** A GO is a verdict on a commit.
