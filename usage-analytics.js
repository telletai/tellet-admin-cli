const chalk = require('chalk');
const ora = require('ora');
const fs = require('fs').promises;
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

class UsageAnalytics {
    constructor(api, options = {}) {
        this.api = api;
        this.options = {
            startDate: options.startDate,
            endDate: options.endDate || new Date().toISOString(),
            outputDir: options.outputDir || './analytics',
            verbose: options.verbose || false,
            organizationId: options.organizationId,
            workspaceId: options.workspaceId
        };
        this.stats = {
            organizations: {},
            workspaces: {},
            projects: {},
            summary: {
                totalOrganizations: 0,
                totalWorkspaces: 0,
                totalProjects: 0,
                totalConversations: 0,
                completedConversations: 0,
                abandonedConversations: 0,
                inProgressConversations: 0,
                totalQuestions: 0,
                totalQuestionsWithProbing: 0
            }
        };
    }

    log(message, type = 'info') {
        if (this.options.verbose) {
            const prefix = type === 'error' ? chalk.red('❌') : 
                          type === 'success' ? chalk.green('✅') : 
                          chalk.blue('ℹ️');
            console.log(`${prefix} ${message}`);
        }
    }

    isWithinDateRange(dateString) {
        if (!this.options.startDate && !this.options.endDate) return true;
        
        const date = new Date(dateString);
        const start = this.options.startDate ? new Date(this.options.startDate) : new Date('1900-01-01');
        const end = new Date(this.options.endDate);
        
        return date >= start && date <= end;
    }

    async collectOrganizationStats() {
        const spinner = ora('Collecting organization statistics...').start();
        
        try {
            let organizations = [];
            
            if (this.options.organizationId) {
                // If specific organization is requested, we need to get its details
                // Since there's no direct endpoint to get a single org, we get all and filter
                const allOrgs = await this.api.get('/organizations');
                
                // Ensure allOrgs is an array
                if (!Array.isArray(allOrgs)) {
                    throw new Error(`Unexpected response from /organizations endpoint. Expected array, got ${typeof allOrgs}`);
                }
                
                const targetOrg = allOrgs.find(org => org._id === this.options.organizationId);
                
                if (!targetOrg) {
                    throw new Error(`Organization ${this.options.organizationId} not found or you don't have access to it`);
                }
                
                organizations = [targetOrg];
                this.log(`Filtering by organization: ${targetOrg.name}`);
            } else if (this.options.workspaceId) {
                // If filtering by workspace, we need to find which organization it belongs to
                const allOrgs = await this.api.get('/organizations');
                
                // Ensure allOrgs is an array
                if (!Array.isArray(allOrgs)) {
                    throw new Error(`Unexpected response from /organizations endpoint. Expected array, got ${typeof allOrgs}`);
                }
                
                // Find the organization that contains this workspace
                for (const org of allOrgs) {
                    const workspaceData = await this.api.get(`/organizations/${org._id}/workspaces`);
                    
                    // Combine private and shared workspaces
                    let allWorkspaces = [];
                    // Check for different possible keys
                    if (workspaceData.privateWorkspaces || workspaceData.priv) {
                        const privateWs = workspaceData.privateWorkspaces || workspaceData.priv || [];
                        allWorkspaces = allWorkspaces.concat(privateWs);
                    }
                    if (workspaceData.sharedWorkspaces || workspaceData.shared) {
                        const sharedWs = workspaceData.sharedWorkspaces || workspaceData.shared || [];
                        allWorkspaces = allWorkspaces.concat(sharedWs);
                    }
                    
                    if (allWorkspaces.some(ws => ws._id === this.options.workspaceId)) {
                        organizations = [org];
                        this.log(`Found workspace in organization: ${org.name}`);
                        break;
                    }
                }
                
                if (organizations.length === 0) {
                    throw new Error(`Workspace ${this.options.workspaceId} not found or you don't have access to it`);
                }
            } else {
                // Get all organizations
                organizations = await this.api.get('/organizations');
                
                // Ensure organizations is an array
                if (!Array.isArray(organizations)) {
                    throw new Error(`Unexpected response from /organizations endpoint. Expected array, got ${typeof organizations}`);
                }
            }
            
            this.stats.summary.totalOrganizations = organizations.length;
            
            for (const org of organizations) {
                spinner.text = `Analyzing organization: ${org.name}`;
                
                this.stats.organizations[org._id] = {
                    id: org._id,
                    name: org.name,
                    workspaces: [],
                    totalProjects: 0,
                    totalConversations: 0,
                    completedConversations: 0,
                    abandonedConversations: 0,
                    inProgressConversations: 0,
                    totalQuestions: 0,
                    totalQuestionsWithProbing: 0
                };
                
                // Get workspaces for this organization
                try {
                    const workspaceData = await this.api.get(`/organizations/${org._id}/workspaces`);
                    
                    // Combine private and shared workspaces
                    let workspaces = [];
                    // Check for different possible keys
                    if (workspaceData.privateWorkspaces || workspaceData.priv) {
                        const privateWs = workspaceData.privateWorkspaces || workspaceData.priv || [];
                        workspaces = workspaces.concat(privateWs);
                    }
                    if (workspaceData.sharedWorkspaces || workspaceData.shared) {
                        const sharedWs = workspaceData.sharedWorkspaces || workspaceData.shared || [];
                        workspaces = workspaces.concat(sharedWs);
                    }
                    
                    // Filter by workspace ID if specified
                    if (this.options.workspaceId) {
                        workspaces = workspaces.filter(ws => ws._id === this.options.workspaceId);
                        if (workspaces.length === 0) {
                            this.log(`Workspace ${this.options.workspaceId} not found in organization ${org.name}`, 'error');
                            continue;
                        }
                    }
                    
                    for (const workspace of workspaces) {
                        await this.collectWorkspaceStats(org._id, workspace);
                    }
                } catch (error) {
                    this.log(`Failed to get workspaces for ${org.name}: ${error.message}`, 'error');
                }
            }
            
            spinner.succeed('Organization statistics collected');
        } catch (error) {
            spinner.fail('Failed to collect organization statistics');
            throw error;
        }
    }

    async collectWorkspaceStats(orgId, workspace) {
        this.log(`Analyzing workspace: ${workspace.name}`);
        
        this.stats.workspaces[workspace._id] = {
            id: workspace._id,
            name: workspace.name,
            organizationId: orgId,
            organizationName: this.stats.organizations[orgId].name,
            projects: [],
            totalProjects: 0,
            totalConversations: 0,
            completedConversations: 0,
            abandonedConversations: 0,
            inProgressConversations: 0,
            totalQuestions: 0,
            totalQuestionsWithProbing: 0
        };
        
        this.stats.organizations[orgId].workspaces.push(workspace._id);
        this.stats.summary.totalWorkspaces++;
        
        try {
            // Get projects for this workspace
            const projects = await this.api.get(
                `/organizations/${orgId}/workspaces/${workspace._id}/projects`
            );
            
            // Ensure projects is an array
            if (!Array.isArray(projects)) {
                this.log(`Warning: Unexpected projects response format for workspace ${workspace.name}`, 'error');
                return;
            }
            
            for (const project of projects) {
                await this.collectProjectStats(orgId, workspace._id, project);
            }
        } catch (error) {
            this.log(`Failed to get projects for ${workspace.name}: ${error.message}`, 'error');
        }
    }

    async collectProjectStats(orgId, workspaceId, project) {
        const projectName = project.name || project.title || project._id;
        this.log(`Analyzing project: ${projectName}`);
        
        const projectStats = {
            id: project._id,
            name: projectName,
            status: project.status,
            organizationId: orgId,
            organizationName: this.stats.organizations[orgId].name,
            workspaceId: workspaceId,
            workspaceName: this.stats.workspaces[workspaceId].name,
            conversations: 0,
            completedConversations: 0,
            abandonedConversations: 0,
            inProgressConversations: 0,
            questions: 0,
            questionsWithProbing: 0,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt
        };
        
        try {
            // Get conversations for this project
            const conversations = await this.api.get(
                `/analyzer/results/${project._id}/conversations`
            );
            
            // Ensure conversations is an array
            if (!Array.isArray(conversations)) {
                this.log(`Warning: Unexpected conversations response format for project ${projectName}`, 'error');
                return;
            }
            
            // Filter conversations by date range
            const filteredConversations = conversations.filter(conv => 
                this.isWithinDateRange(conv.createdAt || conv.updatedAt)
            );
            
            // Count conversations by status
            projectStats.completedConversations = filteredConversations.filter(
                conv => conv.status === 'digested'
            ).length;
            projectStats.abandonedConversations = filteredConversations.filter(
                conv => conv.status === 'abandoned'
            ).length;
            projectStats.inProgressConversations = filteredConversations.filter(
                conv => conv.status === 'in_progress'
            ).length;
            projectStats.conversations = projectStats.completedConversations + 
                                        projectStats.abandonedConversations + 
                                        projectStats.inProgressConversations;
            
            // Get project details with interview questions including follow_up_questions
            try {
                // Use dashboard endpoint to get full project data including follow_up_question field
                const projectData = await this.api.get(
                    `/organizations/${orgId}/workspaces/${workspaceId}/projects/${project._id}`
                );
                
                const questions = projectData.interview_questions || [];
                
                // Count base questions (just the main questions, no probing)
                const baseQuestionCount = questions.length;
                
                // Calculate total follow-up questions
                const totalFollowUpQuestions = questions.reduce((sum, q) => {
                    // Ensure follow_up_question is treated as a number
                    const followUpCount = parseInt(q.follow_up_question) || 0;
                    return sum + followUpCount;
                }, 0);
                
                this.log(`Project ${projectName}: ${baseQuestionCount} base questions, ${totalFollowUpQuestions} follow-up questions`);
                
                // Calculate total questions across all COMPLETED conversations
                // Only count questions for conversations that completed the interview
                
                // Total Questions = base questions × number of completed conversations
                projectStats.questions = baseQuestionCount * projectStats.completedConversations;
                
                // Total Questions with Probing = (base questions + follow-up questions) × number of completed conversations
                projectStats.questionsWithProbing = (baseQuestionCount + totalFollowUpQuestions) * projectStats.completedConversations;
                
            } catch (error) {
                this.log(`Failed to get project details for ${projectName}: ${error.message}`, 'error');
            }
            
        } catch (error) {
            this.log(`Failed to get conversations for ${project.name}: ${error.message}`, 'error');
        }
        
        // Update statistics
        this.stats.projects[project._id] = projectStats;
        this.stats.workspaces[workspaceId].projects.push(project._id);
        this.stats.workspaces[workspaceId].totalProjects++;
        this.stats.workspaces[workspaceId].totalConversations += projectStats.conversations;
        this.stats.workspaces[workspaceId].completedConversations += projectStats.completedConversations;
        this.stats.workspaces[workspaceId].abandonedConversations += projectStats.abandonedConversations;
        this.stats.workspaces[workspaceId].inProgressConversations += projectStats.inProgressConversations;
        this.stats.workspaces[workspaceId].totalQuestions += projectStats.questions;
        this.stats.workspaces[workspaceId].totalQuestionsWithProbing += projectStats.questionsWithProbing;
        
        this.stats.organizations[orgId].totalProjects++;
        this.stats.organizations[orgId].totalConversations += projectStats.conversations;
        this.stats.organizations[orgId].completedConversations += projectStats.completedConversations;
        this.stats.organizations[orgId].abandonedConversations += projectStats.abandonedConversations;
        this.stats.organizations[orgId].inProgressConversations += projectStats.inProgressConversations;
        this.stats.organizations[orgId].totalQuestions += projectStats.questions;
        this.stats.organizations[orgId].totalQuestionsWithProbing += projectStats.questionsWithProbing;
        
        this.stats.summary.totalProjects++;
        this.stats.summary.totalConversations += projectStats.conversations;
        this.stats.summary.completedConversations += projectStats.completedConversations;
        this.stats.summary.abandonedConversations += projectStats.abandonedConversations;
        this.stats.summary.inProgressConversations += projectStats.inProgressConversations;
        this.stats.summary.totalQuestions += projectStats.questions;
        this.stats.summary.totalQuestionsWithProbing += projectStats.questionsWithProbing;
    }

    async generateReport() {
        const spinner = ora('Generating usage report...').start();
        
        try {
            // Create output directory
            await fs.mkdir(this.options.outputDir, { recursive: true });
            
            const timestamp = new Date().toISOString().split('T')[0];
            
            // Build filename suffix based on filters
            let filterStr = '';
            if (this.options.organizationId) {
                const org = Object.values(this.stats.organizations)[0];
                const orgName = org ? org.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() : 'org';
                filterStr += `_${orgName}`;
            }
            if (this.options.workspaceId) {
                const ws = Object.values(this.stats.workspaces)[0];
                const wsName = ws ? ws.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() : 'ws';
                filterStr += `_${wsName}`;
            }
            
            const dateRangeStr = this.options.startDate ? 
                `_${this.options.startDate.split('T')[0]}_to_${this.options.endDate.split('T')[0]}` : 
                '_all_time';
            
            // Generate organization summary CSV
            const orgCsvPath = path.join(
                this.options.outputDir, 
                `organization_usage_summary${filterStr}${dateRangeStr}_${timestamp}.csv`
            );
            await this.generateOrganizationCsv(orgCsvPath);
            
            // Generate workspace summary CSV
            const wsCsvPath = path.join(
                this.options.outputDir, 
                `workspace_usage_summary${filterStr}${dateRangeStr}_${timestamp}.csv`
            );
            await this.generateWorkspaceCsv(wsCsvPath);
            
            // Generate project details CSV
            const projectCsvPath = path.join(
                this.options.outputDir, 
                `project_usage_details${filterStr}${dateRangeStr}_${timestamp}.csv`
            );
            await this.generateProjectCsv(projectCsvPath);
            
            // Generate JSON report
            const jsonPath = path.join(
                this.options.outputDir, 
                `usage_analytics${filterStr}${dateRangeStr}_${timestamp}.json`
            );
            await fs.writeFile(jsonPath, JSON.stringify(this.stats, null, 2));
            
            spinner.succeed('Usage report generated');
            
            return {
                organizationCsv: orgCsvPath,
                workspaceCsv: wsCsvPath,
                projectCsv: projectCsvPath,
                jsonReport: jsonPath
            };
        } catch (error) {
            spinner.fail('Failed to generate report');
            throw error;
        }
    }

    async generateOrganizationCsv(filePath) {
        const csvWriter = createCsvWriter({
            path: filePath,
            header: [
                { id: 'name', title: 'Organization' },
                { id: 'totalWorkspaces', title: 'Workspaces' },
                { id: 'totalProjects', title: 'Projects' },
                { id: 'completedConversations', title: 'Completed Conversations' },
                { id: 'abandonedConversations', title: 'Abandoned Conversations' },
                { id: 'inProgressConversations', title: 'In Progress Conversations' },
                { id: 'totalConversations', title: 'Total Conversations' },
                { id: 'completionRate', title: 'Completion Rate (%)' },
                { id: 'totalQuestions', title: 'Total Questions Asked' },
                { id: 'totalQuestionsWithProbing', title: 'Total Questions (incl. Probing)' }
            ]
        });
        
        const records = Object.values(this.stats.organizations).map(org => ({
            name: org.name,
            totalWorkspaces: org.workspaces.length,
            totalProjects: org.totalProjects,
            completedConversations: org.completedConversations,
            abandonedConversations: org.abandonedConversations,
            inProgressConversations: org.inProgressConversations,
            totalConversations: org.totalConversations,
            completionRate: org.totalConversations > 0 ? 
                ((org.completedConversations / org.totalConversations) * 100).toFixed(1) : '0.0',
            totalQuestions: org.totalQuestions,
            totalQuestionsWithProbing: org.totalQuestionsWithProbing
        }));
        
        await csvWriter.writeRecords(records);
    }

    async generateWorkspaceCsv(filePath) {
        const csvWriter = createCsvWriter({
            path: filePath,
            header: [
                { id: 'organizationName', title: 'Organization' },
                { id: 'name', title: 'Workspace' },
                { id: 'totalProjects', title: 'Projects' },
                { id: 'completedConversations', title: 'Completed Conversations' },
                { id: 'abandonedConversations', title: 'Abandoned Conversations' },
                { id: 'inProgressConversations', title: 'In Progress Conversations' },
                { id: 'totalConversations', title: 'Total Conversations' },
                { id: 'completionRate', title: 'Completion Rate (%)' },
                { id: 'totalQuestions', title: 'Total Questions Asked' },
                { id: 'totalQuestionsWithProbing', title: 'Total Questions (incl. Probing)' }
            ]
        });
        
        const records = Object.values(this.stats.workspaces).map(ws => ({
            organizationName: ws.organizationName,
            name: ws.name,
            totalProjects: ws.totalProjects,
            completedConversations: ws.completedConversations,
            abandonedConversations: ws.abandonedConversations,
            inProgressConversations: ws.inProgressConversations,
            totalConversations: ws.totalConversations,
            completionRate: ws.totalConversations > 0 ? 
                ((ws.completedConversations / ws.totalConversations) * 100).toFixed(1) : '0.0',
            totalQuestions: ws.totalQuestions,
            totalQuestionsWithProbing: ws.totalQuestionsWithProbing
        }));
        
        await csvWriter.writeRecords(records);
    }

    async generateProjectCsv(filePath) {
        const csvWriter = createCsvWriter({
            path: filePath,
            header: [
                { id: 'organizationName', title: 'Organization' },
                { id: 'workspaceName', title: 'Workspace' },
                { id: 'name', title: 'Project' },
                { id: 'status', title: 'Status' },
                { id: 'completedConversations', title: 'Completed Conversations' },
                { id: 'abandonedConversations', title: 'Abandoned Conversations' },
                { id: 'inProgressConversations', title: 'In Progress Conversations' },
                { id: 'conversations', title: 'Total Conversations' },
                { id: 'completionRate', title: 'Completion Rate (%)' },
                { id: 'questions', title: 'Total Questions Asked' },
                { id: 'questionsWithProbing', title: 'Total Questions (incl. Probing)' },
                { id: 'createdAt', title: 'Created' },
                { id: 'updatedAt', title: 'Last Updated' }
            ]
        });
        
        const records = Object.values(this.stats.projects).map(project => ({
            organizationName: project.organizationName,
            workspaceName: project.workspaceName,
            name: project.name,
            status: project.status,
            completedConversations: project.completedConversations,
            abandonedConversations: project.abandonedConversations,
            inProgressConversations: project.inProgressConversations,
            conversations: project.conversations,
            completionRate: project.conversations > 0 ? 
                ((project.completedConversations / project.conversations) * 100).toFixed(1) : '0.0',
            questions: project.questions,
            questionsWithProbing: project.questionsWithProbing,
            createdAt: new Date(project.createdAt).toLocaleDateString(),
            updatedAt: new Date(project.updatedAt).toLocaleDateString()
        }));
        
        await csvWriter.writeRecords(records);
    }

    displaySummary() {
        console.log('\n' + chalk.blue('═'.repeat(60)));
        console.log(chalk.blue.bold('📊 Usage Analytics Summary'));
        console.log(chalk.blue('═'.repeat(60)));
        
        // Show filters
        const filters = [];
        if (this.options.organizationId) {
            const org = Object.values(this.stats.organizations)[0];
            filters.push(`Organization: ${org ? org.name : this.options.organizationId}`);
        }
        if (this.options.workspaceId) {
            const ws = Object.values(this.stats.workspaces)[0];
            filters.push(`Workspace: ${ws ? ws.name : this.options.workspaceId}`);
        }
        if (this.options.startDate) {
            filters.push(`Date Range: ${this.options.startDate.split('T')[0]} to ${this.options.endDate.split('T')[0]}`);
        }
        
        if (filters.length > 0) {
            console.log(chalk.gray(filters.join(' | ')));
            console.log(chalk.blue('─'.repeat(60)));
        }
        
        console.log(chalk.white(`Organizations:           ${chalk.bold(this.stats.summary.totalOrganizations)}`));
        console.log(chalk.white(`Workspaces:              ${chalk.bold(this.stats.summary.totalWorkspaces)}`));
        console.log(chalk.white(`Projects:                ${chalk.bold(this.stats.summary.totalProjects)}`));
        console.log(chalk.blue('─'.repeat(60)));
        console.log(chalk.white(`Completed Conversations: ${chalk.bold(this.stats.summary.completedConversations)}`));
        console.log(chalk.white(`Abandoned Conversations: ${chalk.bold(this.stats.summary.abandonedConversations)}`));
        console.log(chalk.white(`In Progress:             ${chalk.bold(this.stats.summary.inProgressConversations)}`));
        console.log(chalk.white(`Total Conversations:     ${chalk.bold(this.stats.summary.totalConversations)}`));
        
        const completionRate = this.stats.summary.totalConversations > 0 ?
            ((this.stats.summary.completedConversations / this.stats.summary.totalConversations) * 100).toFixed(1) :
            '0.0';
        console.log(chalk.white(`Completion Rate:         ${chalk.bold(completionRate + '%')}`));
        console.log(chalk.blue('─'.repeat(60)));
        console.log(chalk.white(`Total Questions Asked:   ${chalk.bold(this.stats.summary.totalQuestions)}`));
        console.log(chalk.white(`Including Probing:       ${chalk.bold(this.stats.summary.totalQuestionsWithProbing)}`));
        
        console.log(chalk.blue('═'.repeat(60)) + '\n');
        
        // Top organizations by conversations
        console.log(chalk.yellow.bold('🏆 Top Organizations by Completed Conversations:'));
        const topOrgs = Object.values(this.stats.organizations)
            .sort((a, b) => b.completedConversations - a.completedConversations)
            .slice(0, 5);
        
        topOrgs.forEach((org, index) => {
            const rate = org.totalConversations > 0 ? 
                ((org.completedConversations / org.totalConversations) * 100).toFixed(1) : '0.0';
            console.log(`   ${index + 1}. ${org.name}: ${org.completedConversations} completed (${rate}% completion rate)`);
        });
        
        console.log('');
    }

    async run() {
        try {
            await this.collectOrganizationStats();
            const reportPaths = await this.generateReport();
            this.displaySummary();
            
            console.log(chalk.green('\n📄 Reports generated:'));
            console.log(chalk.gray(`   • Organization Summary: ${reportPaths.organizationCsv}`));
            console.log(chalk.gray(`   • Workspace Summary: ${reportPaths.workspaceCsv}`));
            console.log(chalk.gray(`   • Project Details: ${reportPaths.projectCsv}`));
            console.log(chalk.gray(`   • Full JSON Report: ${reportPaths.jsonReport}`));
            
            return this.stats;
        } catch (error) {
            console.error(chalk.red('\n❌ Error collecting usage analytics:'), error.message);
            throw error;
        }
    }
}

module.exports = UsageAnalytics;