# AI Chatbot — PII Expectations (Third-Party Agents)

When your agent uses the For the Cult API to answer order or account questions, the API returns **personally identifiable information (PII)** only when the **current** user is authenticated and the request is authorized for that user. To protect customer data, agents must handle PII appropriately.

---

## Expectations for agents

1. **Do not store or log PII.** Do not persist customer email, name, address, phone number, or other PII from API responses into long-term memory, vector stores, logs, or analytics. Use order/account data only to answer the current user's request in the current conversation.

2. **One user per context.** Do not reuse one customer's data in another customer's conversation. Each conversation (or authenticated session) should have isolated context. When the user logs out or the session ends, do not retain or reuse that user's PII.

3. **PII only with that user's auth.** The API returns PII only when the request includes valid authentication for that customer. There is no way to obtain another customer's PII through the API. Agents must not attempt to cache or reuse PII across users.

---

## Why this matters

Storing or sharing PII across conversations or users can lead to data leakage and violates customer trust and privacy expectations. Follow your platform's best practices for session isolation and ephemeral context when integrating with this API.
