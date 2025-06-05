const axios = require('axios');
const chalk = require('chalk');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class UpdateChecker {
    constructor() {
        this.packageName = '@tellet/admin-cli';
        this.currentVersion = this.getCurrentVersion();
        this.updateCheckFile = path.join(__dirname, '.update-check');
    }

    getCurrentVersion() {
        try {
            const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
            return packageJson.version;
        } catch (error) {
            console.error('Error reading package.json:', error);
            return '0.0.0';
        }
    }

    shouldCheckForUpdate() {
        try {
            if (!fs.existsSync(this.updateCheckFile)) {
                return true;
            }
            const lastCheck = fs.readFileSync(this.updateCheckFile, 'utf8');
            const lastCheckTime = new Date(lastCheck);
            const now = new Date();
            const hoursSinceLastCheck = (now - lastCheckTime) / (1000 * 60 * 60);
            return hoursSinceLastCheck > 24; // Check once per day
        } catch (error) {
            return true;
        }
    }

    updateLastCheckTime() {
        fs.writeFileSync(this.updateCheckFile, new Date().toISOString());
    }

    async checkForUpdate(silent = false) {
        if (!this.shouldCheckForUpdate() && silent) {
            return null;
        }

        try {
            // Check npm registry for latest version
            const response = await axios.get(`https://registry.npmjs.org/${this.packageName}/latest`, {
                timeout: 5000
            });
            
            const latestVersion = response.data.version;
            this.updateLastCheckTime();

            if (this.isNewerVersion(latestVersion, this.currentVersion)) {
                return {
                    current: this.currentVersion,
                    latest: latestVersion,
                    updateAvailable: true
                };
            }
            
            return {
                current: this.currentVersion,
                latest: latestVersion,
                updateAvailable: false
            };
        } catch (error) {
            // Silently fail if we can't check for updates
            if (!silent) {
                console.error(chalk.yellow('Unable to check for updates'));
            }
            return null;
        }
    }

    isNewerVersion(latest, current) {
        const latestParts = latest.split('.').map(Number);
        const currentParts = current.split('.').map(Number);

        for (let i = 0; i < 3; i++) {
            if (latestParts[i] > currentParts[i]) return true;
            if (latestParts[i] < currentParts[i]) return false;
        }
        
        return false;
    }

    displayUpdateNotification(updateInfo) {
        if (!updateInfo || !updateInfo.updateAvailable) return;

        console.log('');
        console.log(chalk.yellow('━'.repeat(60)));
        console.log(chalk.yellow('📦 Update available!'));
        console.log(chalk.yellow(`   Current version: ${updateInfo.current}`));
        console.log(chalk.yellow(`   Latest version:  ${updateInfo.latest}`));
        console.log('');
        console.log(chalk.cyan('   Update with: npm update -g @tellet/admin-cli'));
        console.log(chalk.cyan('   Or run: tellet-admin update'));
        console.log(chalk.yellow('━'.repeat(60)));
        console.log('');
    }

    async performUpdate() {
        console.log(chalk.blue('🔄 Checking for updates...'));
        
        const updateInfo = await this.checkForUpdate(false);
        
        if (!updateInfo) {
            console.log(chalk.red('❌ Unable to check for updates. Please check your internet connection.'));
            return false;
        }

        if (!updateInfo.updateAvailable) {
            console.log(chalk.green(`✅ You're already on the latest version (${updateInfo.current})`));
            return false;
        }

        console.log(chalk.yellow(`📦 Update available: ${updateInfo.current} → ${updateInfo.latest}`));
        console.log(chalk.blue('📥 Installing update...'));

        try {
            // Try to update globally
            execSync(`npm install -g ${this.packageName}@latest`, { 
                stdio: 'inherit',
                encoding: 'utf8'
            });
            
            console.log(chalk.green('✅ Update successful!'));
            console.log(chalk.green(`   Updated to version ${updateInfo.latest}`));
            console.log(chalk.cyan('   Please restart the tool to use the new version.'));
            return true;
        } catch (error) {
            console.error(chalk.red('❌ Update failed. You may need to run with sudo:'));
            console.error(chalk.yellow(`   sudo npm install -g ${this.packageName}@latest`));
            return false;
        }
    }

    async checkAndNotify() {
        // Silent check that only shows notification if update is available
        const updateInfo = await this.checkForUpdate(true);
        this.displayUpdateNotification(updateInfo);
    }
}

module.exports = UpdateChecker;