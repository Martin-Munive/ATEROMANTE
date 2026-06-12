# Security Policy

## Supported Scope
AJEDREZ-GM is currently an early local-training prototype.

Security review focuses on:
- local data privacy;
- secrets handling;
- dependency hygiene;
- safe use of LLM providers;
- clear anti-cheating boundaries for human training matches.

## Reporting
Please open a GitHub issue for non-sensitive security concerns.

Do not include private API keys, private games, private study material, personal data, or exploit payloads in public issues.

## Anti-Cheating Boundary
AJEDREZ-GM is designed for training, study and consent-based assisted sessions.

It must not be used to obtain hidden live assistance in competitive games against humans on external platforms.

Assisted human-vs-human sessions must visibly declare:
- tutor policy;
- engine policy;
- whether help is private, symmetric or shared;
- whether exported games are marked as training-assisted.
