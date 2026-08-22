# Security Policy

## Supported version

Security fixes are applied to the latest revision on the `release` branch and
the production deployment built from it. Older revisions are not supported.

## Reporting a vulnerability

Do not disclose suspected vulnerabilities, credentials, personal data, or
working exploits in a public issue.

Use GitHub's private vulnerability reporting or a draft security advisory from
the repository's **Security** tab when that option is available. If it is not
available, contact the repository owner through their GitHub profile and ask
for a private reporting channel before sharing sensitive details.

Include:

- the affected revision, route, or component;
- clear reproduction steps and the observed impact;
- whether real user or production data was involved;
- a minimal proof of concept with secrets and personal data removed; and
- any suggested remediation or temporary mitigation.

The maintainer will acknowledge a complete report within 3 business days,
provide a status update within 7 business days, and coordinate disclosure only
after a fix or mitigation is available. Response time can vary with severity
and reproducibility.

Good-faith, non-destructive research against systems you own or are explicitly
authorized to test is welcome. Do not perform denial of service, persistence,
credential theft, social engineering, or data exfiltration.

For the application's implemented controls and academic guardrails, see
[`docs/SECURITY.md`](docs/SECURITY.md).
