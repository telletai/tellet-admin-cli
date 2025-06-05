// Helper function for project selection with manual fallback
const inquirer = require('inquirer');
const chalk = require('chalk');

async function selectOrEnterProject(selectProjectFn, credentials) {
  let projectId = await selectProjectFn(credentials);
  
  // If automatic project selection failed, offer manual entry
  if (!projectId) {
    console.log(chalk.yellow('\n💡 Tip: You can find your project ID in the Tellet dashboard URL'));
    console.log(chalk.gray('   Example: If your URL is https://app.tellet.ai/project/abc123...'));
    console.log(chalk.gray('   Then your project ID is: abc123...\n'));
    
    const { manualEntry } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'manualEntry',
        message: 'Would you like to manually enter a project ID?',
        default: true
      }
    ]);
    
    if (manualEntry) {
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
    }
  }
  
  return projectId;
}

module.exports = { selectOrEnterProject };