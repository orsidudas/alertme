# AlertMe

AlertMe is a small alerting platform that lets users subscribe to news categories and receive notifications when new matching news is published.

The project was built as a take-home engineering assignment from an intentionally underspecified product brief. The implementation focuses on a simple, maintainable MVP while keeping the notification architecture flexible enough to support additional channels later.

## Description

The initial product brief described a system where users could receive alerts when "something important happens in the world", including examples such as breaking news, market movements, and natural disasters.

For the MVP, I interpreted this as:

> Users can create persistent alerts for news categories and receive an email whenever new news matching that category is published.

News is currently created by an administrator rather than imported from an external RSS or news provider. This keeps the core alerting workflow deterministic and easy to demonstrate.

### Core flow

```text
User creates an alert
        ↓
Alert is stored as an enabled subscription
        ↓
Admin creates new news
        ↓
System finds all enabled alerts for that category
        ↓
Matching users are notified by email
        ↓
Alert remains enabled
        ↓
Future matching news triggers another notification
```

## Features

### Users

* Register and log in
* Log out and maintain an authenticated session
* Browse news by category
* Create category-based alerts
* View their own alerts
* Enable/disable alerts
* Delete their own alerts
* Receive email notifications when matching news is published

### Admin

* Access the admin area
* Manage news categories
* Create news items
* Create news that triggers matching user alerts
* View administrative information available in the application

### Notifications

The notification system is intentionally separated from alert matching.

The current flow is:

```text
Alert matching
      ↓
Notification service
      ↓
EmailAdapter
      ↓
Resend
      ↓
User email
```

The `EmailAdapter` abstraction means another notification channel can be added later without moving email-provider logic into the alert matching code.

Slack is intentionally not implemented in this MVP.

## Persistent Alerts

An important product decision is that alerts are **persistent subscriptions**, not one-time notifications.

For example, if a user subscribes to the `Technology` category:

```text
Technology news #1 → email sent
Technology news #2 → email sent
Technology news #3 → email sent
```

The alert remains enabled until the user disables or deletes it.

This means the alert itself does not contain a "consumed" or "triggered" state. Each new matching news item is evaluated against the currently enabled alerts.

## Tech Stack

### Frontend

* React
* TypeScript
* Vite

### Backend

* Node.js
* TypeScript
* Fastify

### Database

* SQLite
* `better-sqlite3`

### Authentication

* HTTP-only database-backed sessions
* `bcryptjs` for password hashing
* `USER` and `ADMIN` roles

### Email

* Resend
* An `EmailAdapter` abstraction keeps the notification layer independent from the provider

### Testing

* Vitest
* API and alert-matching tests
* TypeScript type checking
* Production builds

## Project Structure

The project is organized as a small frontend/backend application:

```text
.
├── api/
│   └── backend application
├── web/
│   └── React frontend
├── docs/
│   ├── prompts.md
│   └── spike.md
├── screenshots/
└── README.md
```

The exact implementation is intentionally kept small rather than introducing additional infrastructure such as queues, microservices, or an ORM.

## Getting Started

### Requirements

* Node.js
* npm
* A Resend account/API key if you want to test real email delivery

### Install dependencies

From the repository root:

```bash
npm install
```

### Configure environment variables

Create an environment file for the API using the provided example:

```text
api/.env
```

Configure the required values:

```env
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=your_verified_sender@example.com
```

The API key is a secret and should never be committed to the repository.

The repository's `.gitignore` excludes local environment files.

### Start the application

```bash
npm run dev
```

This starts the frontend and backend development environments.

Open the frontend URL shown by Vite in your browser.

## How to Use

### 1. Register a user

Create a normal user account through the registration screen.

After registration, log in with the account.

### 2. Browse the available news

Open the news section to see the available categories and news items.

For example:

```text
Technology
Markets
World
Science
```

The actual categories depend on the data currently configured in the application.

### 3. Create an alert

As a user, select a category and create an alert.

For example:

```text
Alert:
Technology

Status:
Enabled
```

The alert is stored against the logged-in user.

### 4. Create matching news as an admin

Log in with an administrator account and create a new news item.

For example:

```text
Category: Technology
Title: New technology announcement
```

When the news item is created, the system looks for all enabled alerts belonging to that category.

### 5. Receive the notification

The matching user receives an email containing information about the new news item.

The notification flow is:

```text
Admin creates Technology news
            ↓
Enabled Technology alerts are matched
            ↓
Notification service creates email
            ↓
Resend sends email
            ↓
User receives notification
```

### 6. Verify persistent behavior

Create a category alert and then create multiple news items in the same category.

For example:

```text
Alert: Technology

News 1 → email
News 2 → email
News 3 → email
```

The alert should remain enabled after each notification.

Disable or delete the alert to stop future notifications.

## Admin Setup

The application supports `USER` and `ADMIN` roles.

The admin account/setup is intended for local development and demonstration.

Once authenticated as an administrator, the admin area can be used to manage the news/categories that drive the alerting workflow.

## Testing

The backend includes tests covering the main alerting behavior.

Run the test suite with:

```bash
npm test
```

Type-check the project with:

```bash
npm run typecheck
```

Build the application with:

```bash
npm run build
```

The tests cover cases including:

* Alerts match the correct category
* Alerts do not match the wrong category
* Disabled alerts do not match
* The same enabled alert can match multiple news items
* Multiple users can match the same news item
* Admin-created news can trigger matching alerts
* Notification behavior can be tested without sending real emails

Real email delivery is not used by the automated tests. Tests use a fake email adapter so the test suite remains deterministic.

## Evidence

Screenshots demonstrating the main workflow are stored in [`screenshots/`](screenshots/).

Examples include:

### Alert configuration

### Admin creates news

### Real email notification

> Screenshots are included as development evidence rather than as part of the application's functionality.

## Architecture Decisions

The project intentionally keeps the alerting system simple.

### Alert matching is separate from notification delivery

The matcher answers:

> Which enabled alerts match this news item?

The notification service answers:

> How should those users be notified?

This separation means a future Slack implementation can reuse the same matching logic.

### Notification channels use an adapter

The current implementation uses an email adapter:

```text
Notification service
        ↓
EmailAdapter
        ↓
ResendEmailAdapter
```

A future implementation could add another adapter without changing the alert-matching rules:

```text
Notification service
        ├── EmailAdapter
        ├── SlackAdapter
        └── FutureChannelAdapter
```

### SQLite

SQLite was chosen because the MVP does not require a separate database server. It keeps local development and the take-home submission straightforward while still providing persistent relational data.

### No queue yet

Email delivery currently happens as part of the application flow rather than through a background queue.

Queues, retries, delivery history, and more sophisticated failure handling were intentionally left outside the MVP.

## Scope and Deferred Work

The original brief intentionally leaves several areas open. Rather than implementing all possible interpretations, this MVP focuses on one complete end-to-end workflow.

### Implemented

* User authentication
* User/admin roles
* News categories
* Admin-created news
* Persistent category alerts
* Alert enable/disable/delete
* Alert matching
* Email notifications
* Resend integration
* Automated tests
* Basic admin functionality

### Deferred

* Slack notifications
* RSS/news-provider integration
* Market data alerts
* Natural-disaster data integrations
* Advanced alert rules
* Hashtag-based matching
* Guest alerts
* Notification queues
* Automatic retries
* Notification delivery history
* Multiple notification preferences per alert
* Microservice architecture

These can be added later without changing the basic concept of persistent alerts and separated notification channels.

## Development Process

The assignment was intentionally underspecified, so part of the work was deciding what the MVP should mean before implementing it.

The development process included:

1. Identifying ambiguities in the brief
2. Defining a focused MVP
3. Choosing a simple architecture
4. Implementing the application incrementally
5. Testing the alert semantics
6. Reviewing and correcting an initial one-time-alert implementation
7. Separating notification delivery from alert matching
8. Adding real email delivery
9. Verifying the complete flow with a real email
10. Documenting decisions, prompts, and evidence

### Documentation

* [Product / architecture spike](docs/spike.md)
* [Copilot prompt history](docs/prompt.md)

The prompt history contains the prompts used during the development process, including the prompt that led to the initial one-time alert implementation and the subsequent correction to persistent alerts.

## Current Outcome

The core end-to-end workflow is working:

```text
Register / Login
      ↓
Create persistent category alert
      ↓
Admin creates matching news
      ↓
Alert matcher finds enabled subscriptions
      ↓
Notification service
      ↓
Resend
      ↓
Real email received
```

The application is intentionally an MVP rather than a complete production alerting platform. The architecture leaves room for additional notification channels and richer event sources while keeping the current implementation small and understandable.
