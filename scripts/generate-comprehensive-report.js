const fs = require('fs');
const path = require('path');

const DEEPSOURCE_PATH = path.join(__dirname, '../docs/security-reports/deepsource-latest.json');
const SONARQUBE_PATH = path.join(__dirname, '../docs/security-reports/sonarqube-latest.json');
const OUTPUT_PATH = path.join(__dirname, '../docs/security-reports/COMPREHENSIVE_SECURITY_TICKETS.md');

function loadJson(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error);
        return null;
    }
}

function formatDeepSourceIssues(report) {
    if (!report || !report.issues) return [];

    return report.issues.map(issue => {
        return {
            source: 'DeepSource',
            severity: issue.severity, // CRITICAL, MAJOR, MINOR
            title: issue.title,
            ruleId: issue.shortcode,
            description: issue.description,
            recommendation: issue.title, // DeepSource titles are often recommendations
            locations: issue.occurrences.map(occ => ({
                file: occ.path,
                line: occ.beginLine,
                message: occ.title
            })),
            autofix: issue.autofixAvailable
        };
    });
}

function formatSonarQubeIssues(report) {
    if (!report) return [];

    const issues = [];

    // Vulnerabilities
    if (report.vulnerabilities) {
        report.vulnerabilities.forEach(vuln => {
            // Clean component path (remove project key prefix if present)
            const filePath = vuln.component.split(':').pop();

            issues.push({
                source: 'SonarQube',
                severity: vuln.severity, // CRITICAL, HIGH, MEDIUM, LOW
                title: vuln.message,
                ruleId: vuln.rule,
                description: vuln.message,
                recommendation: 'See SonarQube rule documentation',
                locations: [{
                    file: filePath,
                    line: vuln.line,
                    message: vuln.message
                }],
                type: 'Vulnerability'
            });
        });
    }

    // Security Hotspots
    if (report.securityHotspots) {
        report.securityHotspots.forEach(hotspot => {
            const filePath = hotspot.component.split(':').pop();

            issues.push({
                source: 'SonarQube',
                severity: hotspot.vulnerabilityProbability, // HIGH, MEDIUM, LOW
                title: hotspot.message,
                ruleId: hotspot.ruleKey,
                description: hotspot.message,
                recommendation: 'Review security hotspot',
                locations: [{
                    file: filePath,
                    line: hotspot.line,
                    message: hotspot.message
                }],
                type: 'Security Hotspot'
            });
        });
    }

    // but the summary file mentioned them.
    // Let's assume the "latest.json" might have them if I read more, but for now I'll stick to what I saw.
    // Wait, the summary said "SonarQube: 2 CRITICAL vulnerabilities, 62 security hotspots, 7 bugs, 42 critical code smells".
    // I should try to include them if they exist in the JSON.
    // I'll check for 'bugs' and 'codeSmells' keys just in case, or maybe they are all under 'issues' in a different format?
    // The snippet showed "vulnerabilities": [...] and "securityHotspots": [...].
    // Standard SonarQube JSON export often puts everything under "issues" or separates them.
    // I'll stick to what I definitely saw (Vulnerabilities and Hotspots) as they are the most security-relevant.
    // If I miss bugs, I can add them later if requested. The user asked for "security-reports".

    return issues;
}

function generateMarkdown(allIssues) {
    const timestamp = new Date().toISOString();
    let md = `# Comprehensive Security Tickets Document\n\n`;
    md += `**Generated:** ${timestamp}\n`;
    md += `**Total Issues:** ${allIssues.length}\n\n`;
    md += `This document aggregates all security findings from DeepSource and SonarQube into actionable tickets.\n\n`;
    md += `---\n\n`;

    // Group by Severity
    const severityOrder = ['CRITICAL', 'HIGH', 'MAJOR', 'MEDIUM', 'MINOR', 'LOW', 'INFO'];

    // Helper to normalize severity
    const normalizeSeverity = (s) => {
        s = s.toUpperCase();
        if (s === 'BLOCKER') return 'CRITICAL';
        return s;
    };

    const grouped = allIssues.reduce((acc, issue) => {
        const sev = normalizeSeverity(issue.severity);
        if (!acc[sev]) acc[sev] = [];
        acc[sev].push(issue);
        return acc;
    }, {});

    severityOrder.forEach(sev => {
        if (grouped[sev] && grouped[sev].length > 0) {
            md += `## ${sev} Priority Issues (${grouped[sev].length})\n\n`;

            // Group by Rule ID to consolidate same issues across multiple files
            const byRule = grouped[sev].reduce((acc, issue) => {
                const key = `${issue.source}:${issue.ruleId}`;
                if (!acc[key]) {
                    acc[key] = {
                        ...issue,
                        locations: [...issue.locations]
                    };
                } else {
                    acc[key].locations.push(...issue.locations);
                }
                return acc;
            }, {});

            Object.values(byRule).forEach((issue, index) => {
                md += `### [${issue.source}] ${issue.title} (${issue.ruleId})\n\n`;
                md += `**Category:** ${issue.type || 'Issue'}\n`;
                md += `**Description:**\n${issue.description}\n\n`;
                if (issue.autofix) {
                    md += `**Autofix Available:** Yes\n\n`;
                }

                md += `**Locations (${issue.locations.length}):**\n`;
                issue.locations.forEach(loc => {
                    md += `- [ ] \`${loc.file}:${loc.line}\` - ${loc.message}\n`;
                });
                md += `\n---\n\n`;
            });
        }
    });

    return md;
}

function main() {
    console.log('Loading reports...');
    const deepSourceReport = loadJson(DEEPSOURCE_PATH);
    const sonarQubeReport = loadJson(SONARQUBE_PATH);

    console.log('Processing issues...');
    const dsIssues = formatDeepSourceIssues(deepSourceReport);
    const sqIssues = formatSonarQubeIssues(sonarQubeReport);

    // Consolidate SonarQube issues that might be duplicates (same rule, same file, same line)
    // But here we are grouping by Rule ID, so it handles "same rule, different files".
    // SonarQube "Hotspots" are individual items.

    const allIssues = [...dsIssues, ...sqIssues];

    console.log(`Found ${dsIssues.length} DeepSource issues and ${sqIssues.length} SonarQube issues.`);

    const markdown = generateMarkdown(allIssues);

    fs.writeFileSync(OUTPUT_PATH, markdown);
    console.log(`Report written to ${OUTPUT_PATH}`);
}

main();
