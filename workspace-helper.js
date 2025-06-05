// Helper function for workspace selection
const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');

async function selectWorkspace(credentials, organizationId) {
  const spinner = ora('Fetching workspaces...').start();
  
  try {
    const workspaces = await getWorkspacesFromAPI(credentials, organizationId);
    spinner.stop();
    
    if (workspaces.length === 0) {
      console.log(chalk.yellow('\n⚠️  No workspaces found for this organization.'));
      console.log(chalk.gray('This organization might not have any workspaces yet.'));
      return null;
    }
    
    console.log(chalk.green(`\n✅ Found ${workspaces.length} workspace(s)`));
    
    const workspaceChoices = workspaces.map(ws => ({
      name: `${ws.name || 'Unnamed'} (${ws.type}${ws.projectCount !== undefined ? `, ${ws.projectCount} projects` : ''})`,
      value: ws._id || ws.id
    }));
    
    const { workspaceId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'workspaceId',
        message: 'Select a workspace:',
        choices: [...workspaceChoices, new inquirer.Separator(), { name: '← Cancel', value: null }],
        pageSize: 15
      }
    ]);
    
    return workspaceId;
  } catch (error) {
    spinner.stop();
    console.error(chalk.red('\n❌ Failed to fetch workspaces:'), error.message);
    return null;
  }
}

async function getWorkspacesFromAPI(credentials, organizationId) {
  const axios = require('axios');
  const api = axios.create({
    baseURL: process.env.TELLET_API_URL || 'https://api.tellet.ai',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  // First, we need to login to get a proper token
  try {
    const loginResponse = await api.post('/users/login', {
      email: credentials.email,
      password: credentials.password
    });
    const token = loginResponse.data.token || loginResponse.data.access_token;
    api.defaults.headers['Authorization'] = `Bearer ${token}`;
    
    // Get workspaces
    const response = await api.get(`/organizations/${organizationId}/workspaces`);
    
    // Parse the response - it returns {priv: [], shared: []}
    let workspaces = [];
    if (response.data) {
      if (response.data.priv) {
        workspaces = workspaces.concat(response.data.priv.map(ws => ({
          ...ws,
          type: 'Private'
        })));
      }
      if (response.data.shared) {
        workspaces = workspaces.concat(response.data.shared.map(ws => ({
          ...ws,
          type: 'Shared'
        })));
      }
    }
    
    return workspaces;
  } catch (error) {
    console.error(chalk.red('Failed to fetch workspaces:'), error.message);
    return [];
  }
}

async function selectProjectFromWorkspace(credentials, organizationId, workspaceId) {
  const spinner = ora('Fetching projects...').start();
  
  try {
    // Use the API directly to get projects
    const axios = require('axios');
    const api = axios.create({
      baseURL: process.env.TELLET_API_URL || 'https://api.tellet.ai',
      headers: {
        'Authorization': `Bearer ${credentials.token || credentials.password}`,
        'Content-Type': 'application/json'
      }
    });
    
    // First, we need to login to get a proper token if we don't have one
    if (!credentials.token) {
      try {
        const loginResponse = await api.post('/users/login', {
          email: credentials.email,
          password: credentials.password
        });
        credentials.token = loginResponse.data.token || loginResponse.data.access_token;
        api.defaults.headers['Authorization'] = `Bearer ${credentials.token}`;
      } catch (loginError) {
        spinner.stop();
        console.error(chalk.red('\n❌ Authentication failed'));
        return null;
      }
    }
    
    // Get projects from the workspace
    const response = await api.get(`/organizations/${organizationId}/workspaces/${workspaceId}/projects`);
    spinner.stop();
    
    const projects = response.data || [];
    
    if (projects.length === 0) {
      console.log(chalk.yellow('\n⚠️  No projects found in this workspace.'));
      return null;
    }
    
    const projectChoices = projects.map(project => ({
      name: `${project.title || 'Untitled'} (${project.status || 'Unknown'})`,
      value: project._id || project.id,
      title: project.title,
      status: project.status
    }));
    
    const { projectId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'projectId',
        message: 'Select a project:',
        choices: [...projectChoices, new inquirer.Separator(), { name: '← Cancel', value: null }],
        pageSize: 15
      }
    ]);
    
    return projectId;
  } catch (error) {
    spinner.stop();
    console.error(chalk.red('\n❌ Failed to fetch projects:'), error.message);
    if (error.response && error.response.status === 404) {
      console.error(chalk.yellow('The workspace might not exist or you don\'t have access to it.'));
    }
    return null;
  }
}

module.exports = { selectWorkspace, selectProjectFromWorkspace };