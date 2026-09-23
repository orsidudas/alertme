# Prompt History

## Prompt 001 — Initial assessment

I have an engineering assignment with an intentionally underspecified brief.

I want to take it from ambiguity to a working implementation, but I do NOT want you to start coding yet.

First, act as a senior software engineer helping me reason about the assignment.

Analyze the brief and identify:

1. Ambiguous requirements
2. Assumptions we need to make
3. Questions that would normally be asked of a product owner
4. Which ambiguities we can reasonably resolve ourselves
5. Which decisions could materially affect the architecture or behavior
6. Possible architecture options
7. Possible backend, database, and supporting technology choices
8. What the minimum viable implementation should contain
9. What would be unnecessary overengineering
10. What risks or edge cases we should consider

For technical choices, explain the tradeoffs rather than assuming there is one objectively correct answer.

React + TypeScript is a fixed requirement for the frontend.

Do not create or modify application code yet.

At the end, propose a reasonable implementation plan, but wait for my approval before implementing anything.

Here is the assignment brief:
We want users to be able to set up alerts so they get notified when something important happens in the world - like breaking news, market movements, natural disasters, that kind of thing. Should work for both email and Slack. Make it flexible enough that we can add more channels later. We need an admin view too.


## Prompt 002 — Proposed MVP

I want to proceed with a focused MVP.

For the initial implementation, I want to interpret "something important happens" as:
A new news item is published that matches a user's configured alert criteria.

The initial MVP will focus on news rather than implementing separate market and disaster event integrations.

My proposed product is:

- Users can register and log in.
- Users can browse news.
- Users can't belong to organizations or teams.
- News is organized into categories.
- Admins can also manually create news.
- Alert can be set to different categories.
- Alerts can be enabled/disabled.
- Alerts are private.
- Matching alerts are one-time and should trigger notifications as soon they happen.
- Notifications should support email and Slack.
- The notification architecture should make it straightforward to add additional channels later.
- There should be an admin interface for managing news.

For now, do not implement:
- one alert can notify particular channels
- news can enter the system from configured RSS feeds
- admin interface for managing RSS feed
- market data integrations
- disaster APIs
- complex AND/OR rule builders
- Slack OAuth
- microservices
- unnecessary infrastructure
- logs

The application should be designed so that these could be added later without unnecessarily complicating the MVP.

React + TypeScript is a fixed frontend requirement, but tell me if Vue.js frontend with Python with Django backend would be better fit.

Now propose a concrete technical plan for this MVP.

Specifically cover:

1. Recommended frontend stack
2. Recommended backend stack
3. Database
4. Project structure
5. Core domain models and relationships
6. How RSS ingestion should work
7. How alert matching should work
8. How email and Slack notifications should be represented architecturally
9. Authentication approach
10. Admin authorization
11. API structure
12. Testing strategy
13. Local development setup
14. What should be implemented first, second, third, etc.

For each major technical choice, briefly explain the tradeoff.

Optimize for a simple but extendable solution:
- simple
- demonstrable
- maintainable
- testable
- minimal infrastructure
- easy for a reviewer to understand

This is not a production project, everything should be simple and testable easily. Also Slack can connected with a webhook, so it can be tested with localhost.

Do not create application code yet.

Do not add technologies just because they are commonly used in production.

At the end, give me a proposed implementation sequence with milestones.

Wait for my approval before implementing anything.


## Prompt 003 — Implement the foundation

I like this plan. Let's build it step by step.

For the first step, only set up the project foundation:

- React + TypeScript + Vite frontend
- Node.js + TypeScript + Fastify backend
- SQLite setup
- basic workspace structure
- basic dev scripts
- health endpoint
- frontend/backend connection
- Prisma or another simple DB layer if you think it is needed

Do not build auth, alerts, notifications, admin features, or RSS yet.

Before coding, quickly show me:
1. The folder structure you plan to create
2. The main dependencies you want to add

Then implement it.

Afterwards, tell me:
- what files you created/changed
- how to run it
- what you tested
- what the next step should be

Keep it simple. Don't add things we don't need yet.


## Prompt 004 — Authentication

Let's do the next step: authentication.

Implement only:

- User model/table
- USER and ADMIN roles
- database-backed sessions
- registration
- login
- logout
- current-user endpoint
- password hashing
- basic auth middleware
- admin authorization middleware
- seed/setup for an admin user

Keep the API simple.

Also add the minimum tests needed for this functionality.

Do not implement news, alerts, notifications, RSS, or admin UI yet.

Before coding, briefly tell me what you plan to change. Then implement it.

Afterwards tell me:
- what files you created/changed
- what you tested
- how I can test registration/login/admin locally
- what you think the next step should be

Don't add anything we don't need yet.


## Prompt 005 — Add news and categories

Let's build the next step: news and categories.

Implement only:

- Category model/table
- News item model/table
- public API to list categories
- public API to list/view news
- admin-only API to create news
- basic frontend screens to browse news
- basic admin form to create news

For now:
- each news item belongs to one category
- admin-created news only
- no RSS
- no alerts
- no notifications
- no hashtags
- no advanced filtering

Use the existing authentication and admin authorization.

Before coding, briefly tell me what you plan to change. Then implement it.

Afterwards tell me:
- what files you created/changed
- what you tested
- how I can test browsing news and creating news as admin
- what you think the next step should be

Keep it simple. Don't add anything we don't need yet.


## Prompt 006 — Small fix

Since sourceName and sourceUrl in a newsItem is only relevant when it is from RSS feed, which is a feature for later, let's keep those properties optional.


## Prompt 007 — Small fix

Add admin news update, news deletion,
category creation, category update, category deletion and the UI for them.
And the relevant tests also.

GET /api/admin/news
GET /api/admin/news/:id
PUT /api/admin/news/:id
DELETE /api/admin/news/:id
GET /api/admin/categories
GET /api/admin/categories/:id
POST /api/admin/categories
PUT /api/admin/categories/:id
DELETE /api/admin/categories/:id


## Prompt 008 — Small fix

At home page, the news should be visible. But after login, Admin should see a topMenu with
Manage news, and Manage category, and Manage Users, which shows that options route


## Prompt 008 — Small fix

Add sign up, the default role is USER for everyone who sign up through the form. Only the admins can change the users' roles on the manage user page.

Add relevant tests.


## Prompt 008 — Small fix

Error message should not show if user redirects


## Prompt 008 — Build alerts

Let's build alerts next.

Implement only:

- Alert model/table
- Users can create an alert for a category
- Users can view their own alerts
- Users can enable/disable their alerts
- Users can delete their own alerts
- Basic frontend UI for managing alerts

UI plan:
When users logged in, on topmenu there's the home page which listing the news and the other menuitem is alerts, where users can see all the alerts they set.


An alert should belong to one user and one category.

Keep the matching logic separate for now.

Do not implement:
- email
- Slack
- notification sending
- RSS
- hashtags
- advanced alert rules
- guest alerts

Use the existing authentication and user ownership checks.

Before coding, briefly tell me what you plan to change. Then implement it.

Afterwards tell me:
- what files you created/changed
- what you tested
- how I can test creating and managing an alert
- what the next step should be

Keep it simple and don't add anything we don't need yet.


## Prompt 009 — Fix error

It is throwing a Cannot read properties of null (reading 'reset') error when user tries to create an Alert


## Prompt 010 — Matching alerts

Let's implement alert matching next.

When an admin creates a news item:

- find enabled alerts for that news item's category
- match each alert only once
- mark the matched alert as triggered/consumed
- keep the matching logic separate from notification sending

Add tests for:
- matching category
- wrong category does not match
- disabled alerts do not match
- an alert cannot be triggered twice
- multiple users can match the same news item

Do not implement email, Slack, RSS, or notification settings yet.

Use the existing news, category, alert, and authentication code.

Keep it simple.

Before coding, briefly tell me what you plan to change. Then implement it.

Afterwards tell me what changed and what you tested.


## Prompt 011 — Change alert behavior

The alert behavior needs to change.

An alert is a standing subscription, not a one-time alert.

If a user has an enabled alert for a category, it should trigger for EVERY new news item in that category until the user disables or deletes the alert.

Please change the current alert matching implementation accordingly:

- remove the one-time/consumed behavior
- remove triggered_at
- enabled alerts remain enabled after matching
- matching should happen for every new matching news item
- update the UI so alerts don't show as "Consumed"
- update the tests to verify the same alert matches multiple news items
- keep notification logic out of the matcher

Before making changes, briefly explain what you will change.

Then implement it and run the tests/typecheck/build.

Do not add notifications, Slack, RSS, or other features yet.


## Prompt 012 — Add email notification adapter

Let's add email notifications next.

Implement only:

- a simple email notification service/interface
- a development email adapter that logs the email instead of sending a real email
- connect it to the existing alert matching flow

When an enabled alert matches newly created news:
- send an email to the user's email address
- the alert remains enabled and can trigger again for future matching news
- include the news title and relevant details in the email

Keep notification logic separate from alert matching as much as reasonably possible.

Add tests using a fake email adapter so we can verify that matching alerts produce an email notification.

Do not add Slack, RSS, external email providers, or other features yet.

Before coding, briefly explain the plan. Then implement it and run the tests, typecheck, and build.

Afterwards tell me how I can manually verify the email notification locally.


## Prompt 013 — Fix relations

Let's fix the alert relation. At this stage, user should not have duplicated alerts for the same category.


## Prompt 014 — Fix UI

In the UI, the option for the category should be disable, which user already has.


## Prompt 015 — Add ReSend email delivery

Replace the development email adapter with a real email delivery implementation using a simple external email provider.

Requirements:
- keep the existing EmailAdapter interface
- keep notification logic separate from alert matching
- read the provider API key and sender email from environment variables
- never hardcode secrets
- send the email to the user's email address when an enabled alert matches new news
- keep the alert persistent so future matching news can send another email
- add clear handling for missing email configuration
- update tests so they still use the fake adapter and never send real emails

Do not add Slack, RSS, queues, retries, or other features.

Before coding, briefly tell me which provider/library you will use and why. Then implement it and run tests, typecheck, and build.


## Prompt 016 — Fix API error

The API is reporting:

Email configuration missing: RESEND_API_KEY, EMAIL_FROM

I created a root `.env` with both variables, but the API does not see them.

Please inspect the current project structure and environment-variable loading. Do not change the email architecture or provider.

Make the smallest change necessary so the API loads the root `.env` during local development.

Then run the tests, typecheck, and build.


## Prompt 017 — Add admin improvement

We need one small improvement before we finish.

The admin currently cannot see which users have alerts for which categories, which makes the notification system difficult to verify.

Add a simple read-only admin alerts view showing:
- user email
- category
- enabled/disabled status

Do not allow the admin to edit or delete alerts.

Also improve email delivery error handling:
- if a user has no email address, log that the email was skipped
- if the email provider rejects/fails delivery, log the recipient and provider error clearly
- do not make one failed email prevent notifications from being attempted for other matching users

Keep the existing EmailAdapter and notification architecture.

Do not add new alert rules, Slack, RSS, or other features.

Run tests, typecheck, and build afterwards.
