# edocAI Business Scope

## 1. Purpose

edocAI is a SaaS product for small business owners and solo freelancers who need a faster, more reliable way to turn invoices, receipts, and other expense documents into structured data they can use for bookkeeping, tax preparation, and accounting workflows.

The business goal is to move edocAI from a document extraction tool into a paid, retention-driven finance workflow product built around recurring subscriptions, accounting integrations, email-based ingestion, and reporting features.

## 2. Product Vision

The product should feel like a practical assistant for day-to-day expense management:

- Capture documents from upload, email forwarding, or mobile camera
- Extract structured fields and enrich them with categories, vendor data, and trust signals
- Help users keep books cleaner with QuickBooks sync, tax exports, and duplicate detection
- Encourage ongoing subscription usage through limits, usage visibility, and premium workflows

The primary differentiator is not just extraction quality. It is reducing the full operational burden around expense handling.

## 3. Target Customer

### Primary audience

- Solo freelancers
- Independent consultants
- Small business owners with light finance operations

### Secondary audience

- Very small teams that share a single owner-managed workflow
- Users who want tax-ready expense records without adopting a full accounting platform

### Explicitly out of scope

- Enterprise finance teams
- Approval workflows
- Multi-role procurement or AP automation
- Complex organizational hierarchies

## 4. Core Problem

The current market gap is that many small businesses can upload and extract invoice data, but they still need to manually move that data into accounting software, classify spend, check for duplicates, and keep records organized.

edocAI should solve this by making the document-to-bookkeeping path mostly automatic.

## 5. Value Proposition

edocAI provides three business outcomes:

- Save time on document processing and bookkeeping entry
- Increase financial confidence through cleaner, categorized, deduplicated data
- Improve retention through recurring value features that compound over time, such as sync, email ingestion, and reporting

## 6. Commercial Model

### Pricing tiers

- Free: limited document volume per month, no integrations
- Pro: higher or unlimited usage, integrations, export tools, analytics, and priority processing

### Billing model

- Monthly subscription
- Annual plan with a discount

### Payment provider

- Stripe for subscription management, billing portal, and webhooks

### Packaging principle

The Free tier should demonstrate product value and drive habit formation, while Pro should monetize the workflows that create the most operational leverage:

- Accounting sync
- Email forwarding ingestion
- Tax exports
- Usage and analytics visibility
- Priority processing

## 7. Scope Boundaries

### In scope

- Document ingestion and extraction
- Subscription billing and entitlement management
- Pro feature gating
- Accounting integrations
- Email ingestion
- Tax-related exports and categorization
- Data quality and reporting features
- Mobile capture

### Out of scope for now

- Team approval workflows
- Enterprise admin controls
- Deep ERP integrations beyond the initial accounting providers
- Full AP automation
- Custom workflow engines

## 8. Product Scope Areas

This scope is intentionally organized around business capabilities rather than implementation phases.

### Monetization and entitlement control

- Subscription billing with Free and Pro tiers
- Monthly and annual pricing
- Usage limits tied to plan level
- Upgrade and renewal flows

### Document capture and processing

- Manual uploads
- Mobile capture
- Email-based ingestion
- Asynchronous extraction and status tracking

### Accounting and finance workflow

- QuickBooks synchronization as the initial accounting integration
- Tax categorization and export readiness
- Vendor normalization
- Duplicate and anomaly detection

### Retention and product expansion

- Usage visibility and upgrade prompts
- Analytics and reporting
- Multi-language and multi-currency support for expansion markets

### Trust, compliance, and operational readiness

- Account recovery and password reset
- Data retention and deletion policies
- Secure third-party integrations
- CORS and other deployment hardening

## 9. Success Metrics

Business success should be measured by a mix of activation, retention, and monetization:

- Free-to-Pro conversion rate
- Monthly active users who process documents repeatedly
- Number of users connecting accounting integrations
- Email forwarding adoption rate
- Upload-to-extraction success rate
- Percentage of documents categorized and exported for tax use
- Churn rate after the first billing cycle

## 10. Key Assumptions

- Users will pay for time saved and record-keeping convenience if the workflow is reliable enough
- Accounting sync and email ingestion will be stronger retention drivers than extraction alone
- Free usage limits can be used to encourage conversion without creating immediate abandonment
- The product will remain focused on owner-operated businesses rather than larger finance teams

## 11. Main Risks

- Stripe and webhook complexity could delay monetization if not validated early
- Integration quality may matter more than raw extraction quality for paid conversion
- Data quality issues from duplicate vendors or missing categories could weaken trust
- Email ingestion may introduce deliverability and spoofing concerns that need careful handling
- Analytics and reconciliation only become valuable once the underlying data is clean

## 12. Product Positioning Summary

edocAI should be positioned as a practical expense-document platform for small businesses: easy to start with, useful every week, and valuable enough to justify a subscription once a user needs integrations, automation, and tax-ready records.

The product should evolve from extraction into workflow ownership.
