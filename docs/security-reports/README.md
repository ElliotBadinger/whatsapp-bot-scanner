# Security Reports

This directory contains automated security reports fetched from DeepSource and SonarQube APIs.

## Contents

- **`deepsource-report-*.json`** - Full DeepSource analysis reports
- **`deepsource-security-*.json`** - Security-focused DeepSource reports
- **`sonarqube-report-*.json`** - Full SonarQube analysis reports (when configured)
- **`sonarqube-security-*.json`** - Security-focused SonarQube reports (when configured)
- **`security-summary-*.json`** - Combined security metrics summary
- **`*-latest.json`** - Symlinks/copies to most recent reports

## Generating Reports

Run the security reports fetcher script:

```bash
node scripts/fetch-security-reports.js
```

For SonarQube integration, provide credentials:

```bash
SONARQUBE_TOKEN=your_token \
SONARQUBE_PROJECT_KEY=your_project_key \
node scripts/fetch-security-reports.js
```

## Report Format

See [`security-summary-latest.json`](./security-summary-latest.json) for the latest overview of security metrics across both platforms.

## API Keys

- **DeepSource**: Configured in `scripts/fetch-security-reports.js`
- **SonarQube**: Requires environment variables `SONARQUBE_TOKEN` and `SONARQUBE_PROJECT_KEY`

For more details, see the main project documentation and [fetch-security-reports.js](../scripts/fetch-security-reports.js).
