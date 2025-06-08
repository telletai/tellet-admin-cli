// Helper function for workspace selection
const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');

async function selectWorkspace(api, organizationId) {
  const spinner = ora('Fetching workspaces...').start();
  
  try {
    const workspaces = await getWorkspacesFromAPI(api, organizationId);
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

async function getWorkspacesFromAPI(api, organizationId) {
  try {
    // Get workspaces
    const response = await api.get(`/organizations/${organizationId}/workspaces`);
    const workspaceData = response.data;
    
    // Parse the response - it returns {priv: [], shared: []}
    let workspaces = [];
    if (workspaceData) {
      if (workspaceData.priv) {
        workspaces = workspaces.concat(workspaceData.priv.map(ws => ({
          ...ws,
          type: 'Private'
        })));
      }
      if (workspaceData.shared) {
        workspaces = workspaces.concat(workspaceData.shared.map(ws => ({
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

async function selectProjectFromWorkspace(api, organizationId, workspaceId) {
  const spinner = ora('Fetching projects...').start();
  
  try {
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