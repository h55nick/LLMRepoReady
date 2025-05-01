# Repository Readiness Analyzer

A GitHub Action that analyzes repositories for "vide code" readiness and generates a comprehensive report.

## What is "Vide Code" Readiness?

"Vide Code" readiness refers to a codebase that is:

- **Visible**: Well-documented and easy to understand
- **Integrated**: Has proper CI/CD workflows and integrations
- **Dependable**: Thoroughly tested and reliable
- **Extensible**: Follows good coding standards and is easy to extend

## Features

This GitHub Action analyzes your repository and provides metrics on:

- Test coverage
- Documentation quality
- GitHub Actions/workflows
- Code complexity and standards
- Repository statistics
- Overall readiness score

## Usage

Add the following to your GitHub workflow file:

```yaml
name: Analyze Repository Readiness

on:
  workflow_dispatch:
  schedule:
    - cron: '0 0 * * 1'  # Run weekly on Mondays

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
        
      - name: Analyze Repository Readiness
        uses: h55nick/LLMRepoReady@v1
        with:
          repo: ${{ github.repository }}
          token: ${{ secrets.GITHUB_TOKEN }}
          create-issue: 'true'
          min-score: '70'
        id: analyzer
        
      - name: Check Results
        run: |
          echo "Overall Score: ${{ steps.analyzer.outputs.overall-score }}"
          echo "Passed: ${{ steps.analyzer.outputs.passed }}"
          echo "Report URL: ${{ steps.analyzer.outputs.report-url }}"
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `repo` | The repository to analyze in the format owner/repo | Yes | N/A |
| `token` | GitHub token with access to the repository | Yes | `${{ github.token }}` |
| `create-issue` | Whether to create an issue with the report | No | `false` |
| `analyze-test-coverage` | Whether to analyze test coverage | No | `true` |
| `analyze-documentation` | Whether to analyze documentation | No | `true` |
| `analyze-workflows` | Whether to analyze GitHub workflows | No | `true` |
| `analyze-complexity` | Whether to analyze code complexity and standards | No | `true` |
| `min-score` | Minimum score to pass the analysis (0-100) | No | `70` |

## Outputs

| Output | Description |
|--------|-------------|
| `report-url` | URL to the generated report (if created as an issue) |
| `overall-score` | Overall readiness score (0-100) |
| `test-coverage-score` | Test coverage score (0-100) |
| `documentation-score` | Documentation score (0-100) |
| `workflows-score` | Workflows score (0-100) |
| `complexity-score` | Code complexity score (0-100) |
| `passed` | Whether the repository passed the minimum score threshold |

## Example Report

The action generates a comprehensive markdown report that includes:

- Repository overview and statistics
- Scores for each analyzed metric
- Detailed analysis of each metric
- Recommendations for improvement
- Overall readiness assessment

## License

MIT