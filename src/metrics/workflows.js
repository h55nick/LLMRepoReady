/**
 * Analyzes GitHub workflows and CI/CD setup for a repository
 */
async function analyze(octokit, owner, repo) {
  try {
    // Check for GitHub Actions workflows
    let workflows = [];
    try {
      const workflowsResponse = await octokit.rest.actions.listRepoWorkflows({
        owner,
        repo
      });
      
      workflows = workflowsResponse.data.workflows || [];
    } catch (error) {
      // Workflows might not exist or we might not have permission to access them
    }

    // Check for workflow files in .github/workflows directory
    let workflowFiles = [];
    try {
      const workflowsDir = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: '.github/workflows'
      });
      
      if (Array.isArray(workflowsDir.data)) {
        workflowFiles = workflowsDir.data.filter(file => 
          file.type === 'file' && (file.name.endsWith('.yml') || file.name.endsWith('.yaml'))
        );
      }
    } catch (error) {
      // .github/workflows directory might not exist
    }

    // Check for other CI configuration files
    const ciFiles = [
      '.travis.yml',
      'circle.yml',
      '.circleci/config.yml',
      'Jenkinsfile',
      'azure-pipelines.yml',
      '.gitlab-ci.yml',
      'appveyor.yml',
      '.drone.yml'
    ];
    
    let foundCiFiles = [];
    for (const file of ciFiles) {
      try {
        const response = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: file
        });
        
        if (response.data) {
          foundCiFiles.push(file);
        }
      } catch (error) {
        // File might not exist, which is fine
      }
    }

    // Check for deployment configuration
    const deploymentFiles = [
      'Dockerfile',
      'docker-compose.yml',
      'kubernetes.yml',
      'k8s.yml',
      'helm',
      '.dockerignore',
      'serverless.yml',
      'terraform',
      'netlify.toml',
      'vercel.json',
      'fly.toml',
      'railway.json',
      'heroku.yml',
      'app.yaml'
    ];
    
    let foundDeploymentFiles = [];
    for (const file of deploymentFiles) {
      try {
        const response = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: file
        });
        
        if (response.data) {
          foundDeploymentFiles.push(file);
        }
      } catch (error) {
        // File might not exist, which is fine
      }
    }

    // Check for GitHub Apps and integrations
    let installations = [];
    try {
      const installationsResponse = await octokit.rest.apps.listInstallationsForRepo({
        owner,
        repo
      });
      
      installations = installationsResponse.data.installations || [];
    } catch (error) {
      // We might not have permission to access installations
    }

    // Calculate score based on findings
    let score = 0;
    const details = {
      githubWorkflows: workflows.length,
      workflowFiles: workflowFiles.map(file => file.name),
      ciConfigurationFiles: foundCiFiles,
      deploymentConfigurationFiles: foundDeploymentFiles,
      githubApps: installations.map(app => app.app_slug || app.app_id)
    };

    // Scoring logic
    if (workflows.length > 0 || workflowFiles.length > 0) {
      score += 40; // GitHub Actions setup
    } else if (foundCiFiles.length > 0) {
      score += 30; // Other CI setup
    }
    
    score += Math.min(30, workflowFiles.length * 10); // Up to 30 points for workflow files
    score += Math.min(20, foundDeploymentFiles.length * 5); // Up to 20 points for deployment files
    score += Math.min(10, installations.length * 2); // Up to 10 points for GitHub Apps

    // Generate recommendations
    const recommendations = [];
    if (workflows.length === 0 && workflowFiles.length === 0 && foundCiFiles.length === 0) {
      recommendations.push('Set up CI/CD using GitHub Actions or another CI service');
    }
    if (workflowFiles.length === 0) {
      recommendations.push('Create GitHub workflow files for building, testing, and deploying your code');
    }
    if (foundDeploymentFiles.length === 0) {
      recommendations.push('Add deployment configuration files (Dockerfile, kubernetes.yml, etc.)');
    }
    if (workflowFiles.length > 0 && !workflowFiles.some(file => file.name.includes('test'))) {
      recommendations.push('Add a workflow for running tests');
    }
    if (workflowFiles.length > 0 && !workflowFiles.some(file => file.name.includes('deploy'))) {
      recommendations.push('Add a workflow for deploying your application');
    }

    return {
      score,
      details,
      recommendations
    };
  } catch (error) {
    console.error(`Error analyzing workflows: ${error.message}`);
    return {
      score: 0,
      details: { error: error.message },
      recommendations: ['Set up CI/CD workflows using GitHub Actions']
    };
  }
}

module.exports = { analyze };