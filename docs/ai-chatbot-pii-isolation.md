# AI Chatbot — PII Isolation and Memory Controls (Internal)

Internal guidance for building our own AI chatbot so it does not persist or leak customer PII. Not for public distribution.

---

## The risk

- **Cross-customer leakage:** The AI "remembers" customer A's name, address, or order details and later repeats them to customer B.
- **PII in long-term memory:** PII is written to a persistent store (vector DB, "memory" feature, logs, analytics) and is later exposed or used out of context.
- **Stale context after logout:** The conversation context still holds A's PII after A logs out; the next user (or same user in a new session) is treated as if they have access to that data.

Mitigation: **session-scoped context only**, **never persist PII**, and **clear context on logout**.

---

## Principles

1. **PII exists only at request time.** The AI receives PII only in API responses for the **current** authenticated user. It must not write that PII to any persistent memory or reuse it in a different conversation or session.
2. **One conversation = one context.** Each conversation (or authenticated session) has its own context. Context is not shared across users and is cleared when the user logs out or the session ends.
3. **When auth ends, PII is gone.** After logout or session expiry, the AI must behave as if it has no PII for that user. That implies clearing or not reusing any context that contained PII.

---

## Controls for our AI chatbot

### 1. Session-scoped conversation context

- **Isolate by session (or conversation ID).** Each authenticated session (or each distinct conversation thread) gets a dedicated context (e.g. in-memory buffer or a session-keyed store). Never attach new messages to another session's context.
- **Use the same auth as the API.** When calling `GET /orders/{orderId}` or `GET /orders/me`, send the **current** user's auth (session cookie, JWT, or agent identity). The backend then returns only that user's data. The AI should not have access to another user's tokens or session.

### 2. Do not persist PII

- **No long-term memory for PII.** If the AI has a "memory" or "knowledge" feature (e.g. vector DB, summarization into a user profile), do **not** write PII into it. Either:
  - Disable persistent memory for this chatbot, or
  - Filter all writes: strip email, name, address, phone, order details (beyond order ID and non-PII status) before any write to persistent storage.
- **No PII in logs or analytics.** Do not log full API responses that contain PII. Log only order IDs, status, and non-PII metadata. Same for any analytics or monitoring that might store conversation content.
- **No PII in prompts sent to external models.** If we send conversation history to an LLM, ensure that history is session-scoped and cleared on logout (see below). Do not send one user's PII as "example" or "context" to another user's request.

### 3. Clear context on logout (and session end)

- **On logout or session expiry:** Explicitly clear the conversation context for that session (in-memory buffer, session-keyed cache, or whatever holds the thread). After that, the next request in that thread must not see previous PII.
- **Same for "conversation end".** If we treat "new conversation" or "end of session" as a hard boundary, clear or archive the context so it is never reused for another user.
- **Re-auth:** When the same user logs in again, start a **new** context. Do not reattach old context that might have contained PII from a previous session (safer to start fresh).

### 4. System instructions (prompt) for the AI

Include explicit rules the model must follow, for example:

- "You must never store, log, or add to any long-term memory: customer email, name, address, phone number, or any other personally identifiable information (PII)."
- "You may use PII only to answer the current user's question in this conversation. When the user logs out or the conversation ends, treat all PII as invalid; do not use it again or repeat it to anyone else."
- "You must never reveal one customer's information to another. Each conversation is for one customer only; if you do not have an authenticated session for the current user, do not assume you have access to any previous user's data."

### 5. Technical enforcement (where possible)

- **Ephemeral context only.** Prefer an in-memory or short-lived, session-keyed context that is never written to a shared DB. When the session ends, drop the key or let the TTL expire.
- **No PII in tool/memory APIs.** If the AI can call "save to memory" or "update user profile," either do not expose that for this use case or ensure the implementation strips PII (or rejects writes that look like PII) before persisting.
- **Auth on every request.** Every request that could return PII (e.g. order details) must be bound to the current user's auth. Do not cache API responses keyed only by order ID and reuse them for another user; if we cache at all, key by (userId/sessionId + orderId) and invalidate on logout.

---

## Checklist for implementation

- [ ] **One context per session/conversation** — no cross-user context.
- [ ] **Clear context on logout** (and on session expiry or "end conversation").
- [ ] **No PII in long-term memory** — disable or filter so PII is never written.
- [ ] **No PII in logs/analytics** — only non-PII metadata (e.g. order ID, status).
- [ ] **System prompt** includes: do not store PII; do not reuse PII after logout; never reveal one customer's data to another.
- [ ] **API calls** use the current request's auth only; no reuse of another user's tokens or cached PII.
- [ ] **Re-auth = new context** — do not reuse old context that may have held PII.

---

## Summary

Use session-scoped context, never persist PII, clear context on logout, and give the model explicit instructions not to store or reuse PII. That way the AI "loses" access to sensitive data as soon as the user is no longer authenticated and the context is cleared.
