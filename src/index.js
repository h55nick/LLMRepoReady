const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const path = require('path');
const { markdownTable } = require('markdown-table');

// Import analyzers
const testCoverage = require('./metrics/test-coverage');
const documentation = require('./metrics/documentation');
const workflows = require('./metrics/workflows');
const complexity = require('./metrics/complexity');

async function run() {
  try {
    // Get inputs
    const repoInput = core.getInput('repo', { required: true });
    const token = core.getInput('token', { required: true });
    const createIssue = core.getInput('create-issue') === 'true';
    const analyzeTestCoverage = core.getInput('analyze-test-coverage') === 'true';
    const analyzeDocumentation = core.getInput('analyze-documentation') === 'true';
    const analyzeWorkflows = core.getInput('analyze-workflows') === 'true';
    const analyzeComplexity = core.getInput('analyze-complexity') === 'true';
    const minScore = parseInt(core.getInput('min-score'), 10) || 70;

    // Parse repo input
    const [owner, repo] = repoInput.split('/');
    if (!owner || !repo) {
      throw new Error('Invalid repo format. Expected "owner/repo"');
    }

    // Create octokit client
    const octokit = github.getOctokit(token);

    // Get repository info
    const repoInfo = await octokit.rest.repos.get({
      owner,
      repo
    });

    // Run analyzers
    const results = {};
    
    if (analyzeTestCoverage) {
      core.info('Analyzing test coverage...');
      results.testCoverage = await testCoverage.analyze(octokit, owner, repo);
    }
    
    if (analyzeDocumentation) {
      core.info('Analyzing documentation...');
      results.documentation = await documentation.analyze(octokit, owner, repo);
    }
    
    if (analyzeWorkflows) {
      core.info('Analyzing workflows...');
      results.workflows = await workflows.analyze(octokit, owner, repo);
    }
    
    if (analyzeComplexity) {
      core.info('Analyzing code complexity...');
      results.complexity = await complexity.analyze(octokit, owner, repo);
    }

    // Calculate overall score
    let totalScore = 0;
    let totalWeight = 0;
    
    if (results.testCoverage) {
      totalScore += results.testCoverage.score * 0.3;
      totalWeight += 0.3;
    }
    
    if (results.documentation) {
      totalScore += results.documentation.score * 0.25;
      totalWeight += 0.25;
    }
    
    if (results.workflows) {
      totalScore += results.workflows.score * 0.25;
      totalWeight += 0.25;
    }
    
    if (results.complexity) {
      totalScore += results.complexity.score * 0.2;
      totalWeight += 0.2;
    }
    
    const overallScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
    const passed = overallScore >= minScore;

    // Generate report
    const report = generateReport(repoInfo.data, results, overallScore, passed, minScore);
    
    // Save report to file
    const reportPath = path.join(process.env.GITHUB_WORKSPACE || '.', 'repo-readiness-report.md');
    fs.writeFileSync(reportPath, report);
    
    core.info(`Report saved to ${reportPath}`);

    // Create issue if requested
    let reportUrl = '';
    if (createIssue) {
      core.info('Creating issue with report...');
      const issue = await octokit.rest.issues.create({
        owner,
        repo,
        title: `Repository Readiness Report - ${new Date().toISOString().split('T')[0]}`,
        body: report,
        labels: ['report', 'repository-readiness']
      });
      
      reportUrl = issue.data.html_url;
      core.info(`Issue created: ${reportUrl}`);
    }

    // Set outputs
    core.setOutput('report-url', reportUrl);
    core.setOutput('overall-score', overallScore.toString());
    core.setOutput('passed', passed.toString());
    
    if (results.testCoverage) {
      core.setOutput('test-coverage-score', results.testCoverage.score.toString());
    }
    
    if (results.documentation) {
      core.setOutput('documentation-score', results.documentation.score.toString());
    }
    
    if (results.workflows) {
      core.setOutput('workflows-score', results.workflows.score.toString());
    }
    
    if (results.complexity) {
      core.setOutput('complexity-score', results.complexity.score.toString());
    }

    // Log summary
    core.info(`Overall Score: ${overallScore}/100`);
    core.info(`Passed: ${passed ? 'Yes' : 'No'}`);
    
    if (!passed) {
      core.warning(`Repository did not meet the minimum score threshold of ${minScore}`);
    }
  } catch (error) {
    core.setFailed(`Action failed: ${error.message}`);
  }
}

function generateReport(repoData, results, overallScore, passed, minScore) {
  const scoreEmoji = (score) => {
    if (score >= 80) return '🟢';
    if (score >= 50) return '🟡';
    return '🔴';
  };

  let report = `# Repository Readiness Report

## Repository Overview

- **Name**: [${repoData.name}](${repoData.html_url})
- **Owner**: [${repoData.owner.login}](${repoData.owner.html_url})
- **Description**: ${repoData.description || 'No description provided'}
- **Created**: ${new Date(repoData.created_at).toDateString()}
- **Last Updated**: ${new Date(repoData.updated_at).toDateString()}
- **Stars**: ${repoData.stargazers_count}
- **Forks**: ${repoData.forks_count}
- **Open Issues**: ${repoData.open_issues_count}
- **Default Branch**: ${repoData.default_branch}
- **License**: ${repoData.license ? repoData.license.name : 'No license specified'}

## Overall Readiness Score

${scoreEmoji(overallScore)} **${overallScore}/100** ${passed ? '✅ PASSED' : '❌ FAILED'}

Minimum score threshold: ${minScore}/100

## Metrics Summary

${markdownTable([
  ['Metric', 'Score', 'Status'],
  ['Test Coverage', results.testCoverage ? `${results.testCoverage.score}/100 ${scoreEmoji(results.testCoverage.score)}` : 'Not analyzed', ''],
  ['Documentation', results.documentation ? `${results.documentation.score}/100 ${scoreEmoji(results.documentation.score)}` : 'Not analyzed', ''],
  ['Workflows & CI/CD', results.workflows ? `${results.workflows.score}/100 ${scoreEmoji(results.workflows.score)}` : 'Not analyzed', ''],
  ['Code Complexity & Standards', results.complexity ? `${results.complexity.score}/100 ${scoreEmoji(results.complexity.score)}` : 'Not analyzed', '']
])}

## Detailed Analysis

`;

  // Test Coverage
  if (results.testCoverage) {
    report += `### Test Coverage ${scoreEmoji(results.testCoverage.score)} ${results.testCoverage.score}/100

${markdownTable([
  ['Metric', 'Value'],
  ['Test Directories', results.testCoverage.details.testDirectories.length > 0 ? results.testCoverage.details.testDirectories.join(', ') : 'None found'],
  ['Test Files', results.testCoverage.details.testFiles.toString()],
  ['Test Dependencies', results.testCoverage.details.testDependencies.length > 0 ? results.testCoverage.details.testDependencies.join(', ') : 'None found'],
  ['Coverage Configuration', results.testCoverage.details.hasCoverageConfiguration ? 'Yes' : 'No']
])}

#### Recommendations

${results.testCoverage.recommendations.map(rec => `- ${rec}`).join('\n')}

`;
  }

  // Documentation
  if (results.documentation) {
    report += `### Documentation ${scoreEmoji(results.documentation.score)} ${results.documentation.score}/100

${markdownTable([
  ['Metric', 'Value'],
  ['Documentation Files', results.documentation.details.documentationFiles.length > 0 ? results.documentation.details.documentationFiles.join(', ') : 'None found'],
  ['Documentation Directories', results.documentation.details.documentationDirectories.length > 0 ? results.documentation.details.documentationDirectories.join(', ') : 'None found'],
  ['README Quality', `${results.documentation.details.readmeQuality}/50`],
  ['API Documentation', results.documentation.details.hasApiDocumentation ? 'Yes' : 'No'],
  ['GitHub Pages', results.documentation.details.hasGitHubPages ? 'Yes' : 'No']
])}

#### Recommendations

${results.documentation.recommendations.map(rec => `- ${rec}`).join('\n')}

`;
  }

  // Workflows
  if (results.workflows) {
    report += `### Workflows & CI/CD ${scoreEmoji(results.workflows.score)} ${results.workflows.score}/100

${markdownTable([
  ['Metric', 'Value'],
  ['GitHub Workflows', results.workflows.details.githubWorkflows.toString()],
  ['Workflow Files', results.workflows.details.workflowFiles.length > 0 ? results.workflows.details.workflowFiles.join(', ') : 'None found'],
  ['CI Configuration Files', results.workflows.details.ciConfigurationFiles.length > 0 ? results.workflows.details.ciConfigurationFiles.join(', ') : 'None found'],
  ['Deployment Configuration Files', results.workflows.details.deploymentConfigurationFiles.length > 0 ? results.workflows.details.deploymentConfigurationFiles.join(', ') : 'None found'],
  ['GitHub Apps', results.workflows.details.githubApps.length > 0 ? results.workflows.details.githubApps.join(', ') : 'None found']
])}

#### Recommendations

${results.workflows.recommendations.map(rec => `- ${rec}`).join('\n')}

`;
  }

  // Code Complexity
  if (results.complexity) {
    report += `### Code Complexity & Standards ${scoreEmoji(results.complexity.score)} ${results.complexity.score}/100

${markdownTable([
  ['Metric', 'Value'],
  ['Linting Configuration Files', results.complexity.details.lintingConfigurationFiles.length > 0 ? results.complexity.details.lintingConfigurationFiles.join(', ') : 'None found'],
  ['Linting Dependencies', results.complexity.details.lintingDependencies.length > 0 ? results.complexity.details.lintingDependencies.join(', ') : 'None found'],
  ['Type Checking Files', results.complexity.details.typeCheckingFiles.length > 0 ? results.complexity.details.typeCheckingFiles.join(', ') : 'None found'],
  ['Code Quality Workflow', results.complexity.details.hasCodeQualityWorkflow ? 'Yes' : 'No']
])}

#### Recommendations

${results.complexity.recommendations.map(rec => `- ${rec}`).join('\n')}

`;
  }

  // Summary and next steps
  report += `## Summary

${passed ? '✅ This repository meets the minimum readiness score threshold.' : '❌ This repository does not meet the minimum readiness score threshold.'}

### Next Steps

${[
  ...(!passed ? ['Implement the recommendations above to improve your repository\'s readiness score.'] : []),
  'Run this analysis regularly to track your progress.',
  'Consider adding this action to your repository\'s workflows to automate the analysis.',
  'Share this report with your team to align on improvement priorities.'
].map(step => `- ${step}`).join('\n')}

---

Generated by [Repository Readiness Analyzer](https://github.com/h55nick/LLMRepoReady) on ${new Date().toDateString()}
`;

  return report;
}

run();