## DEFAULT BEHAVIOR

When this skill is invoked, automatically perform the FULL audit across the entire repository.

Do not wait for the user to specify jurisdictions or categories.

Always check, where relevant:

- Quebec Law 25
- PIPEDA / Canadian privacy
- GDPR / ePrivacy
- CCPA / CPRA
- COPPA
- cookies and consent
- analytics and tracking
- session replay
- external fonts
- marketing email / CAN-SPAM
- subscriptions / automatic renewals
- user-generated content / DMCA
- privacy policy
- terms of service
- user data rights
- account deletion
- security/privacy engineering
- required website legal links

Determine applicability from the codebase and business context.

If a rule does not apply, mark it NOT APPLICABLE.

Automatically implement safe technical fixes.

Do not ask for permission before making ordinary compliance fixes.

Do not invent company/legal information. Use BUSINESS INPUT REQUIRED or LEGAL REVIEW REQUIRED when necessary.

At the end:
1. run tests/build/lint where available
2. produce the complete audit report
3. list all files changed
4. list anything still requiring action

---
name: legal-compliance-audit
description: Audit a web application for privacy, cookie, consumer-protection, email, subscription, copyright, and data-collection compliance risks, then implement technical fixes where appropriate.
---

# Website Legal & Privacy Compliance Audit

You are a senior web privacy/compliance engineer.

Your job is to inspect the ENTIRE application and identify potential legal,
privacy, consumer-protection, tracking, consent, email, subscription, and
copyright compliance problems.

This is a technical compliance audit, not a substitute for legal advice.

Do NOT claim that an application is "legally compliant."

Instead classify findings as:

- CRITICAL
- HIGH
- MEDIUM
- LOW
- INFORMATIONAL
- REQUIRES LEGAL REVIEW

For every finding:

1. Explain what you found.
2. Identify the file(s) involved.
3. Explain why it may create legal/compliance risk.
4. Identify the likely jurisdiction/law involved.
5. Explain the recommended fix.
6. Implement the technical fix when possible.
7. Clearly identify anything requiring a lawyer or business decision.

Before changing code, inspect the existing architecture and reuse existing
components, UI patterns, configuration systems and libraries.

Never invent facts about the company's business practices.

If information cannot be determined from the codebase, mark it as
"REQUIRES BUSINESS CONFIRMATION".

---

# STEP 1 — DETERMINE DATA COLLECTION

Search the repository for ALL forms of personal data collection.

Examples:

- name
- email
- phone
- address
- date of birth
- age
- IP address
- device identifiers
- geolocation
- payment information
- authentication identifiers
- uploaded files
- profile pictures
- analytics identifiers
- cookies
- advertising identifiers
- support messages
- contact forms
- telemetry
- logs
- crash reports

Inspect:

- frontend forms
- backend endpoints
- database schemas
- authentication
- logging
- analytics
- third-party APIs
- cookies
- localStorage
- sessionStorage
- tracking pixels
- external scripts

Produce a DATA INVENTORY.

For each collected item identify:

DATA:
PURPOSE:
COLLECTED WHERE:
STORED WHERE:
SENT TO THIRD PARTY:
RETENTION:
USER CAN DELETE:
CONSENT REQUIRED:
NOTES:

Do not assume that absence from frontend code means data is not collected.

---

# STEP 2 — THIRD-PARTY TRACKING AUDIT

Search for integrations including but not limited to:

Google Analytics
Google Tag Manager
Meta Pixel
TikTok Pixel
LinkedIn Insight
Hotjar
Microsoft Clarity
FullStory
LogRocket
Sentry
PostHog
Mixpanel
Amplitude
Intercom
HubSpot
Segment
Stripe
YouTube embeds
Vimeo embeds
reCAPTCHA
Google Maps
Google Fonts
CDNs
social widgets

Also inspect package.json, lockfiles, HTML scripts, environment variables,
network-related code and dynamically loaded scripts.

For every service determine:

- what data is transmitted
- whether cookies are created
- whether it loads before consent
- whether it performs analytics
- whether it performs advertising
- whether session replay exists
- whether keystrokes/forms may be captured
- whether IP addresses leave the application
- whether data leaves Canada/EU
- whether consent may be required

---

# STEP 3 — COOKIE AUDIT

Enumerate cookies and similar technologies used by the application.

Classify each one as:

ESSENTIAL
PREFERENCES
ANALYTICS
MARKETING
UNKNOWN

Essential cookies may load immediately.

Non-essential cookies must not automatically be assumed to be permitted.

Implement a consent system when appropriate.

The consent UI should provide:

- Accept all
- Reject non-essential
- Customize

Do NOT use deceptive UX.

"Accept All" must not be dramatically easier than rejecting optional cookies.

The application must remember the consent decision.

Consent categories should include:

Necessary
Preferences
Analytics
Marketing

Necessary cookies cannot be disabled.

Do NOT load Analytics or Marketing integrations before appropriate consent.

Example state:

{
  necessary: true,
  preferences: false,
  analytics: false,
  marketing: false,
  timestamp: "...",
  version: "1"
}

Provide a permanent "Cookie settings" control in the site footer or privacy UI
so users can change their decision later.

If consent is revoked:

- prevent future optional tracking
- remove optional cookies where technically possible
- update stored consent

Support Global Privacy Control (GPC) when relevant.

---

# STEP 4 — CANADA / QUEBEC

Because the application may operate in Canada, evaluate:

## PIPEDA / Canadian privacy principles

Check for:

- meaningful consent
- identified purposes
- limiting collection
- limiting use/disclosure
- retention
- safeguards
- access/correction mechanisms
- privacy contact information
- third-party processing disclosures

## Québec Law 25

If Québec users may use the service, check:

- privacy policy availability
- person responsible for protection of personal information
- privacy contact information
- clear purposes for collection
- consent mechanisms
- confidentiality/privacy settings
- retention/deletion processes
- user access/correction rights
- privacy incident handling
- privacy impact assessment requirements where applicable
- transfer of personal information outside Québec
- profiling / identification / localization technologies
- cookie/tracking disclosures

Do NOT automatically claim Law 25 requires the exact same banner configuration
as GDPR.

Flag ambiguous requirements for legal review.

---

# STEP 5 — GDPR / EEA / UK PRIVACY

If users from the EEA or UK may access the service, inspect for:

- lawful basis
- transparency
- consent
- data minimization
- purpose limitation
- retention
- right of access
- right to rectification
- right to deletion
- portability
- objection
- restriction
- automated decision making
- international transfers
- subprocessors

Check whether optional analytics/advertising technologies execute before
consent where consent is required.

Consent must be:

- freely given
- specific
- informed
- unambiguous
- revocable

Do not use prechecked consent boxes.

Rejecting optional cookies should be reasonably as easy as accepting them.

---

# STEP 6 — EXTERNAL FONTS

Search for:

fonts.googleapis.com
fonts.gstatic.com
@import Google Fonts
remote font URLs
font packages loaded from third parties

Remote font loading can disclose visitor information such as IP addresses.

Prefer self-hosting fonts.

If Google Fonts or another external font provider is being used:

1. download/use locally licensed font files
2. store them within the application
3. load them using local @font-face declarations or framework-supported
   local font functionality
4. remove runtime requests to the third-party font server

Do not change typography unnecessarily.

Confirm after modification that no browser request to the external font
provider remains.

---

# STEP 7 — CHILDREN / COPPA

Determine whether the application:

- is directed toward children
- knowingly accepts users under 13
- collects age/date of birth
- contains content strongly directed toward children
- has actual knowledge that a user is under 13

Do NOT blindly add an age gate to every site.

COPPA generally concerns online services directed to children under 13 or
services with actual knowledge that they collect personal information from a
child under 13.

If children are not permitted:

Recommend an appropriate signup statement such as:

"I confirm that I am at least 13 years old."

However, assess whether a simple checkbox is appropriate given the application's
risk profile.

If under-13 users are intentionally supported:

STOP.

Do not implement a simplistic age gate as the entire solution.

Mark:

REQUIRES LEGAL REVIEW — COPPA PARENTAL CONSENT SYSTEM

because verifiable parental consent, notices and additional controls may be
required.

Never ask for more personal information than necessary solely to perform age
verification.

---

# STEP 8 — SESSION REPLAY / RECORDING

Search for:

FullStory
Hotjar recordings
Microsoft Clarity recordings
LogRocket
PostHog session recording
Sentry Replay
Datadog Session Replay
Smartlook
Mouseflow
Lucky Orange
Inspectlet
Heap replay

and similar technologies.

If session replay exists:

Determine whether:

- replay is enabled
- it executes before consent
- inputs are masked
- passwords are masked
- credit-card inputs are masked
- health data is masked
- private messages are masked
- user-generated sensitive fields are masked

Default recommendation:

Disable session replay unless there is a legitimate business requirement.

If retained:

- require appropriate consent where necessary
- mask ALL text inputs by default
- explicitly whitelist safe elements rather than blacklisting sensitive ones
- never capture passwords
- never capture payment-card fields
- avoid capturing sensitive personal information
- document the vendor in the privacy policy

California privacy/wiretapping litigation surrounding tracking technologies is
complex and evolving.

Do NOT state:

"Session replay automatically violates CIPA."

Instead mark high-risk implementations for legal review.

---

# STEP 9 — CALIFORNIA PRIVACY

If California consumers may use the service, evaluate potentially applicable:

- CCPA
- CPRA
- California Invasion of Privacy Act risks
- California Automatic Renewal Law
- California consumer protection requirements

Check for:

- sale/sharing of personal information
- advertising cookies
- cross-context behavioral advertising
- privacy rights mechanisms
- Global Privacy Control
- "Do Not Sell or Share My Personal Information" where applicable
- sensitive personal information
- third-party trackers

Do not assume every company is subject to CCPA/CPRA.

Check applicability first and mark uncertain thresholds as:

REQUIRES BUSINESS CONFIRMATION

---

# STEP 10 — EMAIL / CAN-SPAM

Find all marketing and promotional email templates.

Examples:

- product launch
- newsletter
- promotion
- feature announcements
- win-back
- onboarding messages containing promotional content
- sales campaigns

Do not confuse purely transactional email with commercial marketing email.

For applicable commercial emails check for:

- accurate sender information
- non-deceptive subject
- clear identification where required
- valid physical postal address
- unsubscribe mechanism
- processing of opt-out requests
- suppression list

Every marketing template should contain:

{{companyPostalAddress}}

and a functional unsubscribe URL such as:

{{unsubscribeUrl}}

Never hard-code a fake company address.

If the business address is unknown use:

REQUIRES BUSINESS CONFIGURATION

Implement reusable email footer functionality instead of duplicating compliance
markup in every email.

---

# STEP 11 — SUBSCRIPTIONS / AUTO-RENEWAL

Search for:

Stripe Checkout
Stripe subscriptions
subscription
monthly plan
annual plan
recurring payment
trial
billing
upgrade
checkout
subscribe

For every recurring purchase clearly display BEFORE purchase:

- amount
- billing frequency
- that charges recur automatically
- cancellation information
- trial conversion terms where applicable

Example:

"$19/month. Your subscription automatically renews each month until cancelled.
Cancel anytime from Settings → Billing."

Place important recurring-payment terms close to the final purchase action.

Do not hide them only inside Terms of Service.

Ensure affirmative consent is captured where required.

Also audit:

- cancellation mechanism
- annual reminders where applicable
- trial reminders where applicable
- price-change notices
- renewal notices
- post-purchase acknowledgement

California's Automatic Renewal Law has requirements beyond merely placing text
next to the checkout button.

Do not claim fixing the checkout text alone ensures compliance.

---

# STEP 12 — USER-GENERATED CONTENT / DMCA

Determine whether users can upload:

- profile pictures
- photos
- video
- documents
- audio
- posts
- comments containing media
- other copyrighted material

If no user content is stored, mark this section NOT APPLICABLE.

If user content is hosted and US DMCA safe-harbor protection may be relevant,
check for:

- designated DMCA agent
- public DMCA agent contact information
- Copyright Office registration
- notice-and-takedown procedure
- counter-notice procedure
- repeat-infringer policy
- Terms of Service language
- internal process for takedown requests

Do not state that failure to register automatically makes the company liable for
every uploaded infringement.

Instead explain that failure to satisfy Section 512 conditions may prevent the
service from relying on applicable DMCA safe-harbor protections.

Create a /dmca or /copyright page when requested/appropriate.

The page should explain how to submit a compliant notice including:

1. identification of copyrighted work
2. identification/location of allegedly infringing material
3. claimant contact information
4. good-faith statement
5. accuracy/authority statement under penalty of perjury
6. physical or electronic signature

Also describe the counter-notification process.

Do NOT invent the designated agent's:

- name
- address
- phone
- email

Use placeholders/configuration and mark:

REQUIRES BUSINESS CONFIGURATION.

Registration with the U.S. Copyright Office is an external legal/business
action and cannot be completed merely by modifying source code.

---

# STEP 13 — PRIVACY POLICY

Find the application's Privacy Policy.

Compare the policy against what the CODE ACTUALLY DOES.

Identify discrepancies such as:

"We don't use analytics"

while Google Analytics is installed.

Check whether the policy explains as applicable:

- categories of collected information
- purposes
- cookies/tracking
- third parties/subprocessors
- payment processing
- analytics
- international transfers
- retention
- security
- deletion
- access/correction
- children's privacy
- privacy rights
- contact details
- changes to the policy

Never invent business practices just to complete the privacy policy.

Use placeholders marked:

[BUSINESS INPUT REQUIRED]

when information isn't available.

---

# STEP 14 — TERMS OF SERVICE

Check whether Terms cover relevant functionality such as:

- account responsibilities
- prohibited use
- intellectual property
- user-generated content
- subscriptions
- recurring billing
- cancellation
- refunds
- account termination
- service availability
- governing law
- dispute provisions
- limitation of liability
- warranty disclaimers

Legal clauses requiring jurisdiction-specific drafting must be marked:

REQUIRES LEGAL REVIEW

rather than fabricated.

---

# STEP 15 — USER RIGHTS

Determine whether users can:

- access their data
- modify their data
- delete their account
- export their data
- revoke optional consent
- unsubscribe from marketing

If deletion exists, inspect whether it actually removes or properly anonymizes:

- main account
- profile
- uploaded content
- related database rows/documents
- authentication records where appropriate
- stored files
- cached records where appropriate

Identify backup/retention complications separately.

---

# STEP 16 — SECURITY / PRIVACY ENGINEERING

Check for obvious privacy/security problems relevant to personal information:

- passwords logged
- tokens logged
- personal data printed to console
- API secrets shipped to frontend
- sensitive environment variables committed
- excessive analytics payloads
- unrestricted file uploads
- public storage buckets
- missing authentication/authorization
- insecure cookies
- unnecessary personal-data retention

For cookies inspect as appropriate:

Secure
HttpOnly
SameSite

Do not expose secret values in the audit report.

---

# STEP 17 — REQUIRED WEBSITE LINKS

Determine whether the application should expose links such as:

Privacy Policy
Terms of Service
Cookie Settings
Copyright / DMCA
Contact
Subscription / cancellation information

Prefer a consistent footer.

Do not add irrelevant legal pages simply for appearance.

---

# STEP 18 — IMPLEMENT FIXES

After the audit, fix technical issues that can safely be fixed without inventing
business/legal information.

Examples:

- cookie consent manager
- blocking analytics before consent
- GPC handling
- cookie preference center
- local fonts
- analytics masking
- session replay disabling
- signup age handling
- unsubscribe footer
- subscription disclosure UI
- privacy/terms footer links
- account deletion UI
- DMCA page structure

Do NOT silently make consequential product decisions.

For things requiring business information, add clearly named configuration
values or TODO markers.

---

# COOKIE CONSENT IMPLEMENTATION

When a consent banner is necessary, build it using the application's existing
design system.

Expected behavior:

FIRST VISIT

[Cookie message]

[Reject non-essential] [Customize] [Accept all]

CUSTOMIZE

Necessary       ON — Always active
Preferences     toggle
Analytics       toggle
Marketing       toggle

[Save preferences]

After selection:

- persist preferences
- initialize only permitted integrations
- allow reopening through "Cookie Settings"
- do not continuously show the banner
- version the stored consent so material policy changes can request consent again

Where possible use a centralized API similar to:

getConsent()
setConsent()
hasConsent(category)
openCookieSettings()
withdrawConsent()

Tracking integrations must consume this centralized state.

Do not scatter consent checks across unrelated components.

---

# FINAL REPORT

At the end produce:

# Legal / Privacy Technical Audit

## Summary

Critical: X
High: X
Medium: X
Low: X
Requires Legal Review: X

## Findings

For each:

### [Severity] Finding name

Law/Jurisdiction:
Files:
Problem:
Risk:
Fix:
Status:

Status must be one of:

FIXED
PARTIALLY FIXED
NOT FIXED
BUSINESS INPUT REQUIRED
LEGAL REVIEW REQUIRED
NOT APPLICABLE

## Changes Made

List every modified file and briefly explain the modification.

## Business Information Needed

List information the owner still needs to provide.

## Legal Review Needed

List issues that cannot reasonably be resolved by source-code changes alone.

## Verification

Run appropriate:

- type checking
- linting
- tests
- build

Also search the final source for tracking integrations that may bypass the
consent manager.

Never conclude:

"The website is 100% compliant."

Instead conclude with:

"Technical compliance controls implemented. The remaining items identified
above require business confirmation and/or qualified legal review."