/**
 * Analyzes documentation for a repository
 */
async function analyze(octokit, owner, repo) {
  try {
    // Get repository contents to find documentation files
    const contents = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: ''
    });

    // Look for common documentation files and directories
    const docFiles = ['README.md', 'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md', 'LICENSE', 'CHANGELOG.md'];
    const docDirs = ['docs', 'documentation', 'wiki'];
    
    const foundDocFiles = contents.data.filter(item => 
      item.type === 'file' && docFiles.includes(item.name)
    );
    
    const foundDocDirs = contents.data.filter(item => 
      item.type === 'dir' && docDirs.some(dir => item.name.toLowerCase().includes(dir))
    );

    // Check if README.md exists and analyze its content
    let readmeQuality = 0;
    let readmeContent = '';
    try {
      const readme = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: 'README.md'
      });
      
      if (readme.data) {
        readmeContent = Buffer.from(readme.data.content, 'base64').toString();
        
        // Simple quality checks
        if (readmeContent.length > 500) readmeQuality += 5;
        if (readmeContent.length > 2000) readmeQuality += 5;
        if (readmeContent.includes('## ')) readmeQuality += 5; // Has sections
        if (readmeContent.includes('```')) readmeQuality += 5; // Has code examples
        if (readmeContent.includes('![') || readmeContent.includes('<img')) readmeQuality += 5; // Has images
        if (readmeContent.includes('## Installation') || readmeContent.includes('# Installation')) readmeQuality += 5;
        if (readmeContent.includes('## Usage') || readmeContent.includes('# Usage')) readmeQuality += 5;
        if (readmeContent.includes('## API') || readmeContent.includes('# API')) readmeQuality += 5;
        if (readmeContent.includes('## Example') || readmeContent.includes('# Example')) readmeQuality += 5;
        if (readmeContent.includes('## License') || readmeContent.includes('# License')) readmeQuality += 5;
      }
    } catch (error) {
      // README.md might not exist
    }

    // Check for API documentation tools
    let hasApiDocs = false;
    try {
      const apiDocFiles = await Promise.all([
        octokit.rest.repos.getContent({ owner, repo, path: 'jsdoc.json' }).catch(() => null),
        octokit.rest.repos.getContent({ owner, repo, path: '.jsdoc.json' }).catch(() => null),
        octokit.rest.repos.getContent({ owner, repo, path: 'typedoc.json' }).catch(() => null),
        octokit.rest.repos.getContent({ owner, repo, path: 'swagger.json' }).catch(() => null),
        octokit.rest.repos.getContent({ owner, repo, path: 'swagger.yaml' }).catch(() => null),
        octokit.rest.repos.getContent({ owner, repo, path: 'openapi.json' }).catch(() => null),
        octokit.rest.repos.getContent({ owner, repo, path: 'openapi.yaml' }).catch(() => null)
      ]);
      
      hasApiDocs = apiDocFiles.some(file => file !== null);
    } catch (error) {
      // Files might not exist, which is fine
    }

    // Check for GitHub Pages
    let hasGitHubPages = false;
    try {
      const repoDetails = await octokit.rest.repos.get({
        owner,
        repo
      });
      
      hasGitHubPages = repoDetails.data.has_pages;
    } catch (error) {
      // Error checking GitHub Pages
    }

    // Calculate score based on findings
    let score = 0;
    const details = {
      documentationFiles: foundDocFiles.map(file => file.name),
      documentationDirectories: foundDocDirs.map(dir => dir.name),
      readmeQuality,
      hasApiDocumentation: hasApiDocs,
      hasGitHubPages
    };

    // Scoring logic
    score += Math.min(30, foundDocFiles.length * 6); // Up to 30 points for doc files
    score += Math.min(20, foundDocDirs.length * 10); // Up to 20 points for doc directories
    score += readmeQuality; // Up to 50 points for README quality
    if (hasApiDocs) score += 15;
    if (hasGitHubPages) score += 15;

    // Cap at 100
    score = Math.min(100, score);

    // Generate recommendations
    const recommendations = [];
    if (foundDocFiles.length < 3) {
      recommendations.push('Add more documentation files (README.md, CONTRIBUTING.md, CHANGELOG.md, etc.)');
    }
    if (foundDocDirs.length === 0) {
      recommendations.push('Create a dedicated docs directory for comprehensive documentation');
    }
    if (readmeQuality < 25) {
      recommendations.push('Improve your README.md with more sections, examples, and installation instructions');
    }
    if (!hasApiDocs) {
      recommendations.push('Add API documentation using tools like JSDoc, TypeDoc, or OpenAPI');
    }
    if (!hasGitHubPages) {
      recommendations.push('Set up GitHub Pages to host your documentation');
    }

    return {
      score,
      details,
      recommendations
    };
  } catch (error) {
    console.error(`Error analyzing documentation: ${error.message}`);
    return {
      score: 0,
      details: { error: error.message },
      recommendations: ['Create a comprehensive README.md file and add documentation']
    };
  }
}

module.exports = { analyze };