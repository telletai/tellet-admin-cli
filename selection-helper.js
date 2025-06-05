// Unified project selection helper
const inquirer = require('inquirer');
const chalk = require('chalk');

async function selectProjectWithMethod(credentials, selectProject, selectProjectWithFlow) {
  const { selectionMethod } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectionMethod',
      message: 'How would you like to select your project?',
      choices: [
        { name: '🚀 Quick selection (all projects list)', value: 'quick' },
        { name: '📂 Step-by-step (Organization → Workspace → Project)', value: 'flow' },
        { name: '✏️  Manual entry (enter project ID)', value: 'manual' }
      ],
      default: 'flow' // Default to step-by-step since quick scan might fail
    }
  ]);
  
  let projectId = null;
  
  switch (selectionMethod) {
    case 'quick':
      projectId = await selectProject(credentials);
      if (!projectId) {
        console.log(chalk.yellow('\n⚠️  Quick selection failed. Try step-by-step or manual entry.'));
      }
      break;
      
    case 'flow':
      projectId = await selectProjectWithFlow(credentials);
      break;
      
    case 'manual':
      console.log(chalk.yellow('\n💡 Tip: You can find your project ID in the Tellet dashboard URL'));
      console.log(chalk.gray('   Example: https://app.tellet.ai/project/abc123...'));
      
      const { manualProjectId } = await inquirer.prompt([
        {
          type: 'input',
          name: 'manualProjectId',
          message: 'Enter the 24-character project ID:',
          validate: (input) => {
            if (!input) return 'Project ID is required';
            if (!/^[a-f0-9]{24}$/i.test(input)) {
              return 'Project ID must be a 24-character hexadecimal string';
            }
            return true;
          }
        }
      ]);
      projectId = manualProjectId;
      break;
  }
  
  return projectId;
}

module.exports = { selectProjectWithMethod };