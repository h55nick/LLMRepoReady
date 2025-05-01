/**
 * Analyzes test coverage for a repository
 */
async function analyze(octokit, owner, repo) {
  try {
    // Get repository contents to find test directories and files
    const contents = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: ''
    });

    // Look for common test directories and files
    const testDirs = ['test', 'tests', '__tests__', 'spec', 'specs'];
    const testFiles = contents.data.filter(item => 
      (item.type === 'dir' && testDirs.includes(item.name.toLowerCase())) ||
      (item.type === 'file' && item.name.match(/\.(test|spec)\.(js|ts|jsx|tsx|py|rb)$/i))
    );

    // Get package.json to check for test-related dependencies
    let testDependencies = [];
    try {
      const packageJson = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: 'package.json'
      });
      
      if (packageJson.data) {
        const content = Buffer.from(packageJson.data.content, 'base64').toString();
        const pkg = JSON.parse(content);
        
        // Check for test-related dependencies
        const testFrameworks = ['jest', 'mocha', 'jasmine', 'karma', 'cypress', 'playwright', 'puppeteer', 'selenium', 'pytest', 'rspec'];
        const dependencies = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        
        testDependencies = Object.keys(dependencies).filter(dep => 
          testFrameworks.some(framework => dep.toLowerCase().includes(framework))
        );
      }
    } catch (error) {
      // Package.json might not exist, which is fine
    }

    // Look for CI configuration files that might include test coverage
    let hasCoverageConfig = false;
    try {
      const files = await Promise.all([
        octokit.rest.repos.getContent({ owner, repo, path: '.github/workflows' }).catch(() => ({ data: [] })),
        octokit.rest.repos.getContent({ owner, repo, path: 'jest.config.js' }).catch(() => null),
        octokit.rest.repos.getContent({ owner, repo, path: '.nycrc' }).catch(() => null),
        octokit.rest.repos.getContent({ owner, repo, path: '.codecov.yml' }).catch(() => null),
        octokit.rest.repos.getContent({ owner, repo, path: 'coverage' }).catch(() => null)
      ]);
      
      hasCoverageConfig = files.some(file => file !== null && file.data);
    } catch (error) {
      // Files might not exist, which is fine
    }

    // Calculate score based on findings
    let score = 0;
    const details = {
      testDirectories: testDirs.filter(dir => 
        contents.data.some(item => item.type === 'dir' && item.name.toLowerCase() === dir)
      ),
      testFiles: testFiles.length,
      testDependencies,
      hasCoverageConfiguration: hasCoverageConfig
    };

    // Scoring logic
    if (details.testDirectories.length > 0) score += 25;
    if (details.testFiles > 0) score += 25;
    if (details.testDependencies.length > 0) score += 25;
    if (details.hasCoverageConfiguration) score += 25;

    // Generate recommendations
    const recommendations = [];
    if (details.testDirectories.length === 0) {
      recommendations.push('Create dedicated test directories to organize your tests');
    }
    if (details.testFiles === 0) {
      recommendations.push('Add test files for your code components');
    }
    if (details.testDependencies.length === 0) {
      recommendations.push('Add testing frameworks to your project dependencies');
    }
    if (!details.hasCoverageConfiguration) {
      recommendations.push('Configure test coverage reporting in your CI pipeline');
    }

    return {
      score,
      details,
      recommendations
    };
  } catch (error) {
    console.error(`Error analyzing test coverage: ${error.message}`);
    return {
      score: 0,
      details: { error: error.message },
      recommendations: ['Set up a testing framework and add tests to your repository']
    };
  }
}

module.exports = { analyze };