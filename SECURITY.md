# Security Policy

## Supported versions

The Cobalt Guide is operated as a continuously deployed web application. Security fixes target the current deployed release and the default branch; older commits, forks, and third-party deployments are not supported by this project.

## Report a vulnerability privately

Do not open a public issue for a suspected vulnerability.

Use [GitHub private vulnerability reporting](https://github.com/carols12352/thecobaltguide/security/advisories/new) whenever possible. If that channel is unavailable, email `support@sicheng.dev` with the subject `The Cobalt Guide security report` and request a private coordination channel before sending sensitive material.

Include, when safe:

- the affected route, component, or commit;
- impact and realistic attack scenario;
- minimal reproduction steps;
- whether credentials, personal data, or production systems may be involved;
- any suggested remediation or disclosure constraints.

Do not include live credentials, unnecessary personal data, or destructive proof-of-concept payloads. Please allow maintainers time to confirm the report and coordinate a fix before public disclosure.

## Scope

Reports about authentication, authorization, account privacy, data exposure, injection, unsafe redirects, dependency vulnerabilities, cache isolation, rate-limit bypass, or production configuration are welcome. Merchant-data disagreements and multiplier corrections are not security vulnerabilities; use the in-product Report workflow or the merchant-data issue form instead.

The project cannot provide rewards or guarantee response timelines, but good-faith reports will be reviewed and handled as promptly as practical.
