/**
 * Analyzes code complexity and standards for a repository
 */
async function analyze(octokit, owner, repo) {
  try {
    // Check for linting and formatting configuration files
    const lintingFiles = [
      '.eslintrc.js',
      '.eslintrc.json',
      '.eslintrc.yml',
      '.eslintrc',
      '.prettierrc',
      '.prettierrc.js',
      '.prettierrc.json',
      '.prettierrc.yml',
      '.stylelintrc',
      '.stylelintrc.js',
      '.stylelintrc.json',
      '.stylelintrc.yml',
      'pylintrc',
      '.pylintrc',
      '.flake8',
      'mypy.ini',
      '.rubocop.yml',
      'tslint.json',
      '.golangci.yml',
      '.editorconfig'
    ];
    
    let foundLintingFiles = [];
    for (const file of lintingFiles) {
      try {
        const response = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: file
        });
        
        if (response.data) {
          foundLintingFiles.push(file);
        }
      } catch (error) {
        // File might not exist, which is fine
      }
    }

    // Check for package.json to find linting dependencies
    let lintingDependencies = [];
    try {
      const packageJson = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: 'package.json'
      });
      
      if (packageJson.data) {
        const content = Buffer.from(packageJson.data.content, 'base64').toString();
        const pkg = JSON.parse(content);
        
        // Check for linting-related dependencies
        const lintTools = ['eslint', 'prettier', 'stylelint', 'tslint', 'standard', 'xo', 'lint'];
        const dependencies = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        
        lintingDependencies = Object.keys(dependencies).filter(dep => 
          lintTools.some(tool => dep.toLowerCase().includes(tool))
        );
      }
    } catch (error) {
      // Package.json might not exist, which is fine
    }

    // Check for type checking configuration
    const typeCheckingFiles = [
      'tsconfig.json',
      'jsconfig.json',
      'mypy.ini',
      'typing.py',
      'py.typed'
    ];
    
    let foundTypeCheckingFiles = [];
    for (const file of typeCheckingFiles) {
      try {
        const response = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: file
        });
        
        if (response.data) {
          foundTypeCheckingFiles.push(file);
        }
      } catch (error) {
        // File might not exist, which is fine
      }
    }

    // Check for code quality tools in GitHub workflows
    let hasCodeQualityWorkflow = false;
    try {
      const workflowsDir = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: '.github/workflows'
      });
      
      if (Array.isArray(workflowsDir.data)) {
        const workflowFiles = workflowsDir.data.filter(file => 
          file.type === 'file' && (file.name.endsWith('.yml') || file.name.endsWith('.yaml'))
        );
        
        for (const file of workflowFiles) {
          const content = await octokit.rest.repos.getContent({
            owner,
            repo,
            path: file.path
          });
          
          if (content.data) {
            const workflowContent = Buffer.from(content.data.content, 'base64').toString();
            
            if (
              workflowContent.includes('eslint') ||
              workflowContent.includes('prettier') ||
              workflowContent.includes('stylelint') ||
              workflowContent.includes('pylint') ||
              workflowContent.includes('flake8') ||
              workflowContent.includes('rubocop') ||
              workflowContent.includes('golangci-lint') ||
              workflowContent.includes('sonarqube') ||
              workflowContent.includes('sonarcloud') ||
              workflowContent.includes('codeclimate') ||
              workflowContent.includes('codeql')
            ) {
              hasCodeQualityWorkflow = true;
              break;
            }
          }
        }
      }
    } catch (error) {
      // Workflows directory might not exist
    }

    // Calculate score based on findings
    let score = 0;
    const details = {
      lintingConfigurationFiles: foundLintingFiles,
      lintingDependencies,
      typeCheckingFiles: foundTypeCheckingFiles,
      hasCodeQualityWorkflow
    };

    // Scoring logic
    score += Math.min(40, foundLintingFiles.length * 8); // Up to 40 points for linting files
    score += Math.min(20, lintingDependencies.length * 5); // Up to 20 points for linting dependencies
    score += Math.min(20, foundTypeCheckingFiles.length * 10); // Up to 20 points for type checking
    if (hasCodeQualityWorkflow) score += 20; // 20 points for code quality workflow

    // Generate recommendations
    const recommendations = [];
    if (foundLintingFiles.length === 0) {
      recommendations.push('Add linting configuration files (ESLint, Prettier, etc.)');
    }
    if (lintingDependencies.length === 0) {
      recommendations.push('Add linting tools to your project dependencies');
    }
    if (foundTypeCheckingFiles.length === 0) {
      recommendations.push('Add type checking to your project (TypeScript, JSDoc, mypy, etc.)');
    }
    if (!hasCodeQualityWorkflow) {
      recommendations.push('Set up code quality checks in your CI/CD pipeline');
    }

    return {
      score,
      details,
      recommendations
    };
  } catch (error) {
    console.error(`Error analyzing code complexity: ${error.message}`);
    return {
      score: 0,
      details: { error: error.message },
      recommendations: ['Set up linting and code quality tools for your repository']
    };
  }
}

module.exports = { analyze };