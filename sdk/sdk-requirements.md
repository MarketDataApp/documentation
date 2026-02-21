---
title: SDK Requirements
description: Internal language-agnostic SDK requirements for Market Data REST API libraries
sidebar_class_name: hidden
displayed_sidebar: null
hide_table_of_contents: false
unlisted: true
---

# Market Data SDK Requirements

This document defines the requirements for official Market Data SDKs. Use this as acceptance criteria when building or evaluating SDK implementations.

## Core Principle: Language-Idiomatic Design

**SDKs must feel native to their language.** We adapt to the language's conventions—the language does not adapt to us.

This means:
- Use the language's standard patterns for errors, async, and data structures
- Follow the language's naming conventions (snake_case vs camelCase vs PascalCase)
- Return data types that developers in that ecosystem expect
- Don't force patterns from one language onto another
- **Follow official style guides and best practices for each language**

### Required Style Guides

| Language | Style Guide / Best Practices |
|----------|------------------------------|
| Python | [PEP 8](https://peps.python.org/pep-0008/), [PEP 257](https://peps.python.org/pep-0257/) (docstrings) |
| PHP | [PSR-12](https://www.php-fig.org/psr/psr-12/), [PSR-4](https://www.php-fig.org/psr/psr-4/) (autoloading) |
| JavaScript | [MDN Guidelines](https://developer.mozilla.org/en-US/docs/MDN/Writing_guidelines/Writing_style_guide/Code_style_guide/JavaScript) |
| TypeScript | [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/) |
| Go | [Effective Go](https://go.dev/doc/effective_go), [Go Code Review Comments](https://go.dev/wiki/CodeReviewComments) |
| Java | [Google Java Style Guide](https://google.github.io/styleguide/javaguide.html) |
| C# | [.NET Framework Design Guidelines](https://docs.microsoft.com/en-us/dotnet/standard/design-guidelines/) |
| Rust | [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/) |

SDKs must pass the standard linter for their language (e.g., `ruff` for Python, `phpcs` for PHP, `golint` for Go).

| Language | Error Handling | Async Pattern | Default Output | Naming |
|----------|---------------|---------------|----------------|--------|
| Python | Exceptions* | Sync (async optional) | pandas DataFrame | snake_case |
| JavaScript | Promise rejection | async/await | Plain objects | camelCase |
| PHP | Exceptions | Sync | Objects/arrays | camelCase |
| Go | Return `error` | Blocking + context | Structs | PascalCase exported |
| Java | Exceptions | CompletableFuture | POJOs | camelCase |
| C# | Exceptions | Task async/await | Objects | PascalCase |
| Rust | Return `Result<T, E>` | async with runtime | Structs | snake_case |

> **\* Python SDK Technical Debt:** The current Python SDK (v1.x) returns `MarketDataClientErrorResult` instead of raising exceptions. This is non-idiomatic and will be fixed in v2.0. **New SDKs must use idiomatic patterns from day one.**

---

## Quick Reference

| Requirement | Priority |
|-------------|----------|
| Bearer token authentication | Must |
| Environment-based configuration | Must |
| Connection pooling | Must |
| Configurable timeouts | Must |
| Typed input validation | Must |
| Typed output models | Must |
| Structured error handling | Must |
| Rate limit tracking | Must |
| Retry with exponential backoff | Must |
| API status awareness | Should |
| Multiple output formats | Should |
| Batch/concurrency helpers | Should |
| DataFrame integration | Optional |

---

## 1. Client Architecture

### 1.1 Client Object

The SDK must expose a top-level client object (e.g., `MarketDataClient`) that:

- Accepts an API token via constructor parameter OR reads from environment variable `MARKETDATA_TOKEN`
- Allows base URL override (default: `https://api.marketdata.app`)
- Allows API version override (default: `v1`)
- Uses a single HTTP client instance with connection pooling
- Provides explicit cleanup/close method for releasing resources
- Exposes current rate limit state
- Sets User-Agent header: `marketdata-sdk-{language}/{version}` (e.g., `marketdata-sdk-php/1.0.0`)
- Default HTTP timeout: **60 seconds** (configurable)

### 1.2 Resource Groupings

The client must expose these resource namespaces:

```
client.stocks
client.options
client.funds
client.markets
client.utilities
```

---

## 2. Required Endpoints

### 2.1 Stocks Resource

| Method | Endpoint | Required Parameters |
|--------|----------|---------------------|
| `prices()` | `/v1/stocks/quotes/` | `symbols` (string or array) |
| `quotes()` | `/v1/stocks/bulkquotes/` | `symbols` (string or array) |
| `candles()` | `/v1/stocks/candles/{resolution}/` | `symbol`, `resolution`, date params |
| `earnings()` | `/v1/stocks/earnings/` | `symbol` |
| `news()` | `/v1/stocks/news/` | `symbol` |

### 2.2 Options Resource

| Method | Endpoint | Required Parameters |
|--------|----------|---------------------|
| `chain()` | `/v1/options/chain/` | `symbol` |
| `expirations()` | `/v1/options/expirations/` | `symbol` |
| `strikes()` | `/v1/options/strikes/` | `symbol` |
| `quotes()` | `/v1/options/quotes/` | `symbols` (option symbols) |
| `lookup()` | `/v1/options/lookup/` | `userInput` |

### 2.3 Funds Resource

| Method | Endpoint | Required Parameters |
|--------|----------|---------------------|
| `candles()` | `/v1/funds/candles/{resolution}/` | `symbol`, `resolution`, date params |

### 2.4 Markets Resource

| Method | Endpoint | Required Parameters |
|--------|----------|---------------------|
| `status()` | `/v1/markets/status/` | At least one of: `country`, `date`, `from`/`to` |

### 2.5 Utilities Resource

| Method | Endpoint | Required Parameters | Notes |
|--------|----------|---------------------|-------|
| `status()` | `/status/` | None | Public, no auth required |
| `headers()` | `/headers/` | None | Debug endpoint |
| `user()` | `/v1/user/` | None | Returns rate limit info |

---

## 3. Universal Parameters

All endpoint methods must support these parameters:

| Parameter | Values | Description |
|-----------|--------|-------------|
| `dateformat` | `timestamp`, `unix`, `spreadsheet` | Controls date output format |
| `columns` | array of strings | Filter response to specific columns |
| `headers` | boolean | Include headers in CSV output |
| `human` | boolean | Use human-readable field names |

---

## 4. Configuration Cascade

All SDKs must implement a three-tier configuration system where more specific settings override less specific ones:

### Priority Order (Lowest → Highest)

| Priority | Source | Scope | Example |
|----------|--------|-------|---------|
| 1 (lowest) | `.env` file | Project-level | `.env` file in project root |
| 2 | Environment variables | System/shell | `export MARKETDATA_TOKEN=...` |
| 3 | Client defaults | Per-client instance | `client.default_params.output_format = "json"` |
| 4 (highest) | Method parameters | Per-request | `client.stocks.prices("AAPL", output_format="csv")` |

SDKs should automatically load `.env` files from the current working directory if present.

### How It Works

When making a request, merge configuration in order:
1. Load `.env` file values (if present)
2. Override with system environment variables
3. Override with client default parameters
4. Override with direct method parameters

### Example Flow

```
.env file: MARKETDATA_OUTPUT_FORMAT=internal
Shell env: MARKETDATA_OUTPUT_FORMAT=json
Client default: output_format=dataframe
Method call: client.stocks.prices("AAPL", output_format="csv")

Result: output_format="csv" (method parameter wins)
```

### Supported Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `MARKETDATA_TOKEN` | API authentication token | (none) |
| `MARKETDATA_BASE_URL` | API base URL | `https://api.marketdata.app` |
| `MARKETDATA_API_VERSION` | API version | `v1` |
| `MARKETDATA_LOGGING_LEVEL` | SDK logging level | `INFO` |
| `MARKETDATA_OUTPUT_FORMAT` | Default output format | (language default) |
| `MARKETDATA_DATE_FORMAT` | Default date format | `timestamp` |
| `MARKETDATA_COLUMNS` | Columns to include | (all) |
| `MARKETDATA_ADD_HEADERS` | Include headers in CSV | `true` |
| `MARKETDATA_USE_HUMAN_READABLE` | Human-readable field names | `false` |
| `MARKETDATA_MODE` | Data mode (live/cached/delayed) | `live` |

---

## 5. Authentication

### Requirements

- Set `Authorization: Bearer {token}` header on all requests
- Token resolution follows the configuration cascade:
  1. `.env` file (lowest)
  2. System environment variable `MARKETDATA_TOKEN`
  3. Client constructor parameter (highest)
- **Validate token on startup**: Call `/v1/user/` during client initialization. If token is invalid, **fail immediately** with a clear error - don't wait until the first API call
- **Never log tokens** - redact in all log output

### Demo Mode

When no token is provided:

- Omit Authorization header
- Log a warning about demo mode limitations
- Skip rate limit initialization

---

## 6. Error Handling

### 6.1 Error Taxonomy

All SDKs must define these error types:

| Error Type | When to Use |
|------------|-------------|
| `AuthenticationError` | 401 responses, invalid/missing token |
| `BadRequestError` | 400 responses, invalid parameters |
| `NotFoundError` | 404 responses |
| `RateLimitError` | 429 responses, rate limit exceeded |
| `ServerError` | 5xx responses |
| `NetworkError` | Connection failures, timeouts |
| `ParseError` | Failed to parse response |

### 6.2 Support Context

Every error must include these fields for support staff troubleshooting:

| Field | Source | Example |
|-------|--------|---------|
| `request_id` | `cf-ray` response header | `"8a1b2c3d4e5f6g7h-SJC"` |
| `request_url` | Full request URL | `"https://api.marketdata.app/v1/stocks/quotes/"` |
| `status_code` | HTTP status code | `429` |
| `timestamp` | SDK-generated (US/Eastern) | `"2025-02-21 12:00:00"` |
| `message` | Error description | `"Rate limit exceeded"` |
| `exception_type` | Error class name | `"RateLimitError"` |

### 6.3 Support Info Helper

SDKs must provide a formatted `support_info` string for users to send to support:

```
--- MARKET DATA SUPPORT INFO ---
request_id:     8a1b2c3d4e5f6g7h-SJC
request_url:    https://api.marketdata.app/v1/stocks/quotes/
status_code:    429
timestamp:      2025-02-21 12:00:00
message:        Rate limit exceeded
exception_type: RateLimitError
--------------------------------
```

This must be accessible via `error.support_info` or equivalent.

### 6.4 Language-Specific Patterns

Follow the idiomatic error handling pattern for each language:

| Language | Pattern | Example |
|----------|---------|---------|
| Python | Raise exceptions | `raise RateLimitError(...)` |
| JavaScript | Reject promises | `throw new RateLimitError(...)` |
| PHP | Throw exceptions | `throw new RateLimitException(...)` |
| Go | Return error | `return nil, &RateLimitError{...}` |
| Java | Throw exceptions | `throw new RateLimitException(...)` |
| C# | Throw exceptions | `throw new RateLimitException(...)` |
| Rust | Return Result | `Err(MarketDataError::RateLimit {...})` |

**Do not** force exception-based error handling onto Go or Rust. **Do not** force Result types onto Python or PHP.

---

## 7. Logging

### Log Format

Use a consistent log format across all SDKs:

```
{timestamp} - {logger_name} - {level} - {message}
```

Example: `2025-02-21 12:00:00 - marketdata.client - INFO - Making request to /v1/stocks/quotes/`

### Log Levels

Configurable via `MARKETDATA_LOGGING_LEVEL` environment variable:

| Level | What to Log |
|-------|-------------|
| DEBUG | Token (redacted), request details, response headers |
| INFO | Client initialization, base URL, API version |
| WARNING | Demo mode, deprecated features |
| ERROR | Request failures, rate limit errors |

### Required Log Points

- Client initialization (INFO)
- Token value - **redacted** (DEBUG): show only last 4 chars
- Request URL (DEBUG)
- Response status and timing (DEBUG/INFO based on status)
- Errors with support context (ERROR)

### Token Redaction

Never log full tokens. Redact to show only last 4 characters:

```
Token: ************************************YKT0
```

---

## 8. Rate Limiting

### 8.1 Initialization

On client creation (with valid token):

1. Call `GET /v1/user/` to fetch rate limit info
2. Store initial limits: `daily_limit`, `requests_remaining`, `reset_time`

### 8.2 Tracking

After every request:

1. Parse rate limit headers from response:
   - `x-api-ratelimit-limit`
   - `x-api-ratelimit-remaining`
   - `x-api-ratelimit-reset`
2. Update internal rate limit state

### 8.3 Pre-flight Check

Before each request:

1. Check if `requests_remaining <= 0`
2. If exhausted, throw `RateLimitError` immediately (don't make the request)

### 8.4 Expose State

Provide method to check current rate limits:

```
client.rate_limits
// Returns: { limit: 50000, remaining: 49500, reset: 1708531200 }
```

---

## 9. Retries and Backoff

### 9.1 HTTP Status Code Handling

| Status Code | Action |
|-------------|--------|
| 200 | Success - parse response |
| 203 | Success - non-authoritative (cached data) - parse response |
| 400 | Throw `BadRequestError` - do not retry |
| 401 | Throw `AuthenticationError` - **fail immediately**, do not retry |
| 404 | Return empty/no-data response (not an error for most endpoints) |
| 429 | Throw `RateLimitError` - do not retry, expose retry-after |
| 5xx | Retry with exponential backoff |

**Note on 404**: Most endpoints return 404 when no data exists (e.g., no quotes for a delisted symbol). SDKs should return an empty result object with `no_data = true` rather than throwing an exception.

### 9.2 Retry Conditions

Retry requests only when:

- HTTP status >= 500 (server errors)
- Network/connection errors

**Never retry**: 4xx errors, rate limit errors

### 9.3 Backoff Strategy

- Use exponential backoff: `min(initial * 2^attempt, max_backoff)`
- Default initial: 1 second
- Default max backoff: 30 seconds
- Default max attempts: 3

### 9.4 Retry-After Header

If response includes `Retry-After` header:

- Respect the server-specified delay
- Override calculated backoff with server value

### 9.5 API Status Check

Before retrying:

1. Check `/v1/status/` endpoint (**cache for 4.5 minutes** to avoid excessive status checks)
2. If API status is `offline`, don't retry - fail immediately
3. If API status is `online` or `unknown`, proceed with retry

---

## 10. Timeouts

### Requirements

- Default request timeout: **60 seconds**
- Timeout must be configurable via client constructor
- Apply timeout to all HTTP requests

---

## 11. Output Formats

### Language-Specific Defaults

Each SDK should return data in the format most natural for that language:

| Language | Default Output | Notes |
|----------|---------------|-------|
| Python | pandas DataFrame | DataFrames are the standard for financial data in Python |
| JavaScript | Plain objects/arrays | Native JS objects, easily JSON-serializable |
| PHP | Objects or associative arrays | Follow PHP conventions |
| Go | Typed structs | Strongly typed, no reflection magic |
| Java | POJOs | Standard Java bean patterns |
| C# | Typed objects | .NET conventions |
| Rust | Typed structs | With serde for serialization |

### Additional Format Support

SDKs may optionally support multiple output formats where it makes sense:

| Format | When to Support |
|--------|-----------------|
| Raw JSON | Always available as an option |
| CSV export | If useful for the language ecosystem |
| Alternative DataFrames | Python: support Polars as alternative to pandas |

### Date Handling

- Parse Unix timestamps to the language's native datetime type
- Normalize to US/Eastern timezone by default
- Respect `dateformat` parameter for output

### Response Object Features

All response objects should provide:

#### Format Detection Methods

| Method | Returns |
|--------|---------|
| `isJson()` | `true` if response is JSON format |
| `isCsv()` | `true` if response is CSV format |
| `isHtml()` | `true` if response is HTML format |

#### File Saving

```
response.saveToFile("/path/to/output.csv")
```

- Save response data to a file
- Automatically determine format from extension or response type
- Return the file path or a success indicator

#### No-Data Detection

```
response.no_data  // or response.hasData()
```

- Indicate when a 404 response returned no data
- Allow callers to distinguish "no data" from errors

---

## 12. Concurrency Helpers

### Global Concurrency Pool

SDKs must enforce a **maximum of 50 concurrent requests** at the client level using a **sliding window** (not batching):

- All endpoints share a single concurrency pool
- Maintain exactly 50 active requests at all times (when demand exists)
- As soon as one request completes, start the next immediately
- **Not batching**: Don't wait for all 50 to finish before starting more
- Must be thread-safe / goroutine-safe / async-safe depending on language

```
# Correct (sliding window):
# Request 1 completes → Request 51 starts immediately
# Request 2 completes → Request 52 starts immediately
# Always 50 in-flight until queue is exhausted

# Wrong (batching):
# Wait for all 50 to complete → Start next 50
# This wastes time waiting for slowest request
```

### stocks.candles() - Date Range Splitting

For intraday resolutions with date ranges > 1 year:

1. Split into year-sized chunks
2. Fetch chunks concurrently (respects global pool limit)
3. Merge results into single response

### options.quotes() - Batch Processing

For multiple option symbols:

1. Fetch quotes concurrently (respects global pool limit)
2. Merge results into single response

---

## 13. Testing Requirements

### Unit Tests (No Real API Calls)

Unit tests must use **mocks for all HTTP requests** - never hit the real API:

- Use language-appropriate HTTP mocking library
- Mock `/user/` and `/status/` endpoints in test fixtures
- Test both success and error scenarios for each endpoint

**Must cover:**
- [ ] URL construction for all endpoints
- [ ] Parameter validation and error messages
- [ ] Error type mapping (status code → error type)
- [ ] Retry behavior and backoff timing
- [ ] Rate limit header parsing
- [ ] Response parsing and model creation
- [ ] Date/time normalization

### Integration Tests (Real API Calls)

Integration tests make **actual REST requests** to the live API:

- Gated by environment variable (e.g., `MARKETDATA_RUN_INTEGRATION_TESTS=true`)
- Require valid API token
- Test real request/response cycles
- Verify actual API behavior matches expectations
- **Not run in CI by default** - only on explicit trigger or release

### Code Coverage

- **100% code coverage required**
- Lines that cannot be tested must be explicitly marked with coverage ignore comments
  - Python: `# pragma: no cover`
  - PHP: `// @codeCoverageIgnore`
  - Go: Use build tags or explicit skip
  - Use language-appropriate ignore syntax
- Coverage ignore must include a comment explaining why

### CI Requirements

- Run **unit tests** on every PR and push to main
- Run on multiple runtime versions
- Produce coverage reports (must be 100% or CI fails)
- Integration tests: manual trigger or release pipeline only

---

## 14. Documentation Requirements

### README Must Include

- [ ] Installation instructions
- [ ] Quick start example (auth + first request)
- [ ] Environment variable configuration
- [ ] Error handling example
- [ ] Link to full documentation

### API Documentation

- Document all public methods
- Include parameter types and descriptions
- Show example usage for each endpoint
- Document error types and when they occur

---

## 15. Packaging Requirements

### Version & Changelog

- Use Semantic Versioning (MAJOR.MINOR.PATCH)
- Maintain CHANGELOG.md following Keep a Changelog format
- **Version must be automatically detected** from the package manager metadata (e.g., `composer.json`, `setup.py`, `go.mod`) - do not hardcode version strings

### Package Registry

| Language | Registry |
|----------|----------|
| Python | PyPI |
| JavaScript | npm |
| Java | Maven Central |
| Go | Go modules (pkg.go.dev) |
| C# | NuGet |
| Rust | crates.io |

### License

- MIT license required
- Include LICENSE file in distribution

---

## 16. Security Requirements

- [ ] Never log API tokens - redact/obfuscate in all output
- [ ] Support environment variable token loading (no hardcoding)
- [ ] Error messages must not contain sensitive data
- [ ] Validate TLS certificates (no skip-verify options)

---

## Acceptance Checklist

Before accepting an SDK, verify:

### Core Functionality
- [ ] All required endpoints implemented
- [ ] Bearer authentication works
- [ ] Token validated on startup (fail fast)
- [ ] Environment variable configuration works
- [ ] Configuration cascade (env → client defaults → method params)
- [ ] Rate limits are tracked and exposed
- [ ] Errors are typed with support context
- [ ] 401 errors fail immediately (no retry)
- [ ] 404 returns no-data response (not exception)
- [ ] Retries use exponential backoff (5xx only)
- [ ] Timeouts configurable (60s default)
- [ ] Concurrency pool enforced (50 max sliding window)
- [ ] User-Agent header set correctly

### Code Quality
- [ ] Unit tests exist and pass (mocked, no real API calls)
- [ ] Integration tests exist (gated by env var)
- [ ] 100% code coverage (or explicit ignores with comments)
- [ ] CI pipeline configured
- [ ] Code follows language style guide (PEP 8, PSR-12, etc.)
- [ ] Passes standard linter for language
- [ ] No security issues (token leakage, etc.)

### Response Objects
- [ ] Format detection methods (isJson, isCsv, isHtml)
- [ ] File saving capability (saveToFile)
- [ ] No-data detection property

### Documentation
- [ ] README with quick start
- [ ] All methods documented
- [ ] Examples provided

### Distribution
- [ ] Published to appropriate registry
- [ ] SemVer versioning
- [ ] Version auto-detected from package metadata
- [ ] Changelog exists
- [ ] MIT license included
