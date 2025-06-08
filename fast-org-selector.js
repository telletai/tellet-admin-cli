const chalk = require('chalk');
const ora = require('ora');

// Fast organization selector that only fetches organizations without nested data
async function selectOrganizationFast(api) {
    const spinner = ora('Fetching organizations...').start();
    
    try {
        const response = await api.get('/organizations');
        const organizations = response.data || [];
        
        spinner.stop();
        
        if (organizations.length === 0) {
            console.log(chalk.yellow('\n⚠️  No organizations found.'));
            return null;
        }
        
        // Return organizations in a format suitable for inquirer
        return organizations.map(org => ({
            name: org.name,
            value: org._id,
            short: org.name
        }));
    } catch (error) {
        spinner.fail('Failed to fetch organizations');
        console.error(chalk.red('Error:'), error.message);
        return null;
    }
}

// Fast workspace selector that only fetches workspaces for a specific organization
async function selectWorkspaceFast(api, organizationId) {
    const spinner = ora('Fetching workspaces...').start();
    
    try {
        const response = await api.get(`/organizations/${organizationId}/workspaces`);
        const workspaceData = response.data;
        
        // Combine private and shared workspaces
        let workspaces = [];
        if (workspaceData.priv) {
            workspaces = workspaces.concat(workspaceData.priv);
        }
        if (workspaceData.shared) {
            workspaces = workspaces.concat(workspaceData.shared);
        }
        
        spinner.stop();
        
        if (workspaces.length === 0) {
            console.log(chalk.yellow('\n⚠️  No workspaces found in this organization.'));
            return null;
        }
        
        // Return workspaces in a format suitable for inquirer
        return workspaces.map(ws => ({
            name: ws.name,
            value: ws._id,
            short: ws.name
        }));
    } catch (error) {
        spinner.fail('Failed to fetch workspaces');
        console.error(chalk.red('Error:'), error.message);
        return null;
    }
}

// Fast project selector that only fetches projects for a specific workspace
async function selectProjectFast(api, organizationId, workspaceId) {
    const spinner = ora('Fetching projects...').start();
    
    try {
        const response = await api.get(
            `/organizations/${organizationId}/workspaces/${workspaceId}/projects`
        );
        const projects = response.data || [];
        
        spinner.stop();
        
        if (projects.length === 0) {
            console.log(chalk.yellow('\n⚠️  No projects found in this workspace.'));
            return null;
        }
        
        // Return projects in a format suitable for inquirer
        return projects.map(project => ({
            name: `${project.title || 'Untitled'} (${project.status})`,
            value: project._id,
            short: project.title || project._id
        }));
    } catch (error) {
        spinner.fail('Failed to fetch projects');
        console.error(chalk.red('Error:'), error.message);
        return null;
    }
}

module.exports = {
    selectOrganizationFast,
    selectWorkspaceFast,
    selectProjectFast
};