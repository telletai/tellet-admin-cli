const fs = require('fs');
const path = require('path');

// Health check criteria and scoring
const HEALTH_CHECKS = {
    // Critical issues (10 points each)
    HAS_CONVERSATIONS: {
        name: 'Has Conversations',
        category: 'critical',
        points: 10,
        check: (project, stats) => stats.totalConversations > 0,
        message: (project, stats) => stats.totalConversations === 0 ? 
            '❌ No conversations found' : 
            `✅ ${stats.totalConversations} conversations found`
    },
    HAS_QUESTIONS: {
        name: 'Has Interview Questions',
        category: 'critical',
        points: 10,
        check: (project, stats) => stats.totalQuestions > 0,
        message: (project, stats) => stats.totalQuestions === 0 ? 
            '❌ No interview questions configured' : 
            `✅ ${stats.totalQuestions} questions configured`
    },
    IS_PUBLISHED: {
        name: 'Project Status',
        category: 'critical',
        points: 10,
        check: (project, stats) => {
            // If status is unknown but we have conversations, consider it active
            if (project.status === 'UNKNOWN' && stats.totalConversations > 0) return true;
            return project.status === 'PUBLISHED' || project.status === 'COMPLETED';
        },
        message: (project, stats) => {
            if (project.status === 'UNKNOWN' && stats.totalConversations > 0) {
                return '✅ Project appears active (has conversations)';
            }
            if (project.status === 'DRAFT') return '⚠️  Project is in DRAFT status';
            if (project.status === 'ARCHIVED') return '⚠️  Project is ARCHIVED';
            if (project.status === 'UNKNOWN') return '⚠️  Project status unknown';
            return `✅ Project status: ${project.status}`;
        }
    },
    
    // Major issues (5 points each)
    COMPLETION_RATE: {
        name: 'Completion Rate',
        category: 'major',
        points: 5,
        check: (project, stats) => stats.completionRate >= 50,
        message: (project, stats) => {
            if (stats.totalConversations === 0) return '⏭️  No conversations to analyze';
            return stats.completionRate < 50 ? 
                `⚠️  Low completion rate: ${stats.completionRate.toFixed(1)}%` : 
                `✅ Completion rate: ${stats.completionRate.toFixed(1)}%`;
        }
    },
    HAS_CATEGORIES: {
        name: 'Question Categories',
        category: 'major',
        points: 5,
        check: (project, stats) => stats.questionsWithCategories >= stats.totalQuestions * 0.8,
        message: (project, stats) => {
            if (stats.totalQuestions === 0) return '⏭️  No questions to categorize';
            const percentage = (stats.questionsWithCategories / stats.totalQuestions * 100).toFixed(0);
            return percentage < 80 ? 
                `⚠️  Only ${percentage}% of questions have categories` : 
                `✅ ${percentage}% of questions have categories`;
        }
    },
    RECENT_ACTIVITY: {
        name: 'Recent Activity',
        category: 'major',
        points: 5,
        check: (project, stats) => {
            if (!stats.lastConversationDate) return false;
            const daysSinceLastActivity = (new Date() - new Date(stats.lastConversationDate)) / (1000 * 60 * 60 * 24);
            return daysSinceLastActivity <= 30;
        },
        message: (project, stats) => {
            if (!stats.lastConversationDate) return '⚠️  No conversation activity';
            const daysSinceLastActivity = Math.floor((new Date() - new Date(stats.lastConversationDate)) / (1000 * 60 * 60 * 24));
            return daysSinceLastActivity > 30 ? 
                `⚠️  No activity in ${daysSinceLastActivity} days` : 
                `✅ Last activity ${daysSinceLastActivity} days ago`;
        }
    },
    
    // Minor issues (3 points each)
    HAS_THEME: {
        name: 'Has Theme',
        category: 'minor',
        points: 3,
        check: (project, stats) => project.theme_id != null,
        message: (project, stats) => project.theme_id ? 
            '✅ Custom theme configured' : 
            '⚠️  No custom theme'
    },
    AVERAGE_DURATION: {
        name: 'Conversation Duration',
        category: 'minor',
        points: 3,
        check: (project, stats) => {
            if (stats.avgDuration === 0) return true; // No data is not a problem
            return stats.avgDuration >= 5 && stats.avgDuration <= 60; // 5-60 minutes is healthy
        },
        message: (project, stats) => {
            if (stats.avgDuration === 0) return '⏭️  No duration data';
            if (stats.avgDuration < 5) return `⚠️  Very short conversations: ${stats.avgDuration.toFixed(1)} min avg`;
            if (stats.avgDuration > 60) return `⚠️  Very long conversations: ${stats.avgDuration.toFixed(1)} min avg`;
            return `✅ Healthy conversation duration: ${stats.avgDuration.toFixed(1)} min avg`;
        }
    },
    ERROR_RATE: {
        name: 'Error Rate',
        category: 'minor',
        points: 3,
        check: (project, stats) => stats.errorRate < 10,
        message: (project, stats) => {
            if (stats.totalConversations === 0) return '⏭️  No conversations to analyze';
            return stats.errorRate >= 10 ? 
                `⚠️  High error rate: ${stats.errorRate.toFixed(1)}%` : 
                `✅ Low error rate: ${stats.errorRate.toFixed(1)}%`;
        }
    }
};

// Calculate health score
function calculateHealthScore(project, stats) {
    let totalPoints = 0;
    let earnedPoints = 0;
    const results = {};
    
    for (const [key, check] of Object.entries(HEALTH_CHECKS)) {
        totalPoints += check.points;
        const passed = check.check(project, stats);
        if (passed) {
            earnedPoints += check.points;
        }
        results[key] = {
            name: check.name,
            category: check.category,
            passed,
            message: check.message(project, stats)
        };
    }
    
    const score = Math.round((earnedPoints / totalPoints) * 100);
    const grade = 
        score >= 90 ? 'A' :
        score >= 80 ? 'B' :
        score >= 70 ? 'C' :
        score >= 60 ? 'D' : 'F';
    
    return {
        score,
        grade,
        totalPoints,
        earnedPoints,
        results
    };
}

// Get project statistics
async function getProjectStats(api, projectId) {
    try {
        // Get conversations first - this is the most reliable endpoint
        let conversations = [];
        try {
            const conversationsResponse = await api.get(`/analyzer/results/${projectId}/conversations`);
            conversations = conversationsResponse.data || [];
        } catch (error) {
            throw new Error(`Project ${projectId} not found or inaccessible: ${error.message}`);
        }
        
        // Create a minimal project object
        let project = {
            _id: projectId,
            id: projectId,
            title: `Project ${projectId}`,
            status: 'UNKNOWN',
            created_at: new Date().toISOString(),
            interview_questions: []
        };
        
        // Try to get project title from interview questions if available
        try {
            const questionsResponse = await api.get(`/analyzer/results/${projectId}/interview_questions`);
            if (questionsResponse.data && questionsResponse.data.length > 0) {
                // Successfully got questions, project exists
                project.status = 'PUBLISHED'; // If we can access it, it's likely published
                project.title = `Project ${projectId.slice(-6)}`; // Use last 6 chars as identifier
            }
        } catch (error) {
            // Continue with minimal info
        }
        
        // Get questions - try multiple approaches
        let questions = [];
        try {
            // First try the interview questions endpoint
            const questionsResponse = await api.get(`/analyzer/results/${projectId}/interview_questions`);
            questions = questionsResponse.data || [];
        } catch (error) {
            // If that fails, try questions endpoint
            try {
                const questionsResponse = await api.get(`/analyzer/results/${projectId}/questions`);
                questions = questionsResponse.data || [];
            } catch (error2) {
                // Finally, check if project object has interview_questions
                questions = project.interview_questions || [];
            }
        }
        
        // Calculate statistics
        const totalConversations = conversations.length;
        const digestedConversations = conversations.filter(c => c.status === 'digested').length;
        const abandonedConversations = conversations.filter(c => c.status === 'abandoned').length;
        const failedConversations = conversations.filter(c => 
            c.status === 'failed' || c.status === 'error' || c.status === 'prescreening_failed'
        ).length;
        
        // Calculate completion rate
        const completionRate = totalConversations > 0 ? 
            (digestedConversations / totalConversations) * 100 : 0;
        
        // Calculate error rate
        const errorRate = totalConversations > 0 ? 
            (failedConversations / totalConversations) * 100 : 0;
        
        // Get last conversation date
        const sortedConversations = conversations
            .filter(c => c.created_at)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const lastConversationDate = sortedConversations.length > 0 ? 
            sortedConversations[0].created_at : null;
        
        // Calculate average duration
        let avgDuration = 0;
        const durationsInMinutes = conversations
            .filter(c => c.duration && c.duration > 0)
            .map(c => c.duration / 60); // Convert to minutes
        
        if (durationsInMinutes.length > 0) {
            avgDuration = durationsInMinutes.reduce((a, b) => a + b, 0) / durationsInMinutes.length;
        }
        
        // Count questions with categories
        let questionsWithCategories = 0;
        
        // First try to count from questions array
        questionsWithCategories = questions.filter(q => {
            // Check for categories in different possible locations
            return (q.categories && q.categories.length > 0) || 
                   (q.category && q.category.length > 0) ||
                   (q.ai_categories && q.ai_categories.length > 0);
        }).length;
        
        // If no categories found and we have questions, try to get categories from categorization endpoint
        if (questionsWithCategories === 0 && questions.length > 0) {
            try {
                const categoriesResponse = await api.get(`/analyzer/categorization/${projectId}`);
                const categoriesData = categoriesResponse.data || {};
                
                // Count questions that have categories
                questionsWithCategories = questions.filter(q => {
                    const questionId = q.id || q._id;
                    return categoriesData[questionId] && categoriesData[questionId].length > 0;
                }).length;
            } catch (error) {
                // Categories endpoint not available, stick with count from questions
            }
        }
        
        return {
            project,
            totalConversations,
            digestedConversations,
            abandonedConversations,
            failedConversations,
            completionRate,
            errorRate,
            lastConversationDate,
            avgDuration,
            totalQuestions: questions.length,
            questionsWithCategories
        };
        
    } catch (error) {
        console.error(`Failed to get stats for project ${projectId}:`, error.message);
        throw error;
    }
}

// Get all projects for a workspace
async function getWorkspaceProjects(api, workspaceId, organizationId = null) {
    console.log(`📂 Fetching projects from workspace ${workspaceId}...`);
    
    try {
        // If organization ID is not provided, we need to find it
        if (!organizationId) {
            // Try to get organizations first
            const orgsResponse = await api.get('/organizations');
            let workspaceFound = false;
            
            // Search through organizations to find which one contains this workspace
            for (const org of orgsResponse.data) {
                try {
                    const workspacesResponse = await api.get(`/organizations/${org._id}/workspaces`);
                    const allWorkspaces = [
                        ...(workspacesResponse.data.priv || []),
                        ...(workspacesResponse.data.shared || [])
                    ];
                    
                    const workspace = allWorkspaces.find(ws => ws._id === workspaceId);
                    if (workspace) {
                        organizationId = org._id;
                        workspaceFound = true;
                        console.log(`✅ Found workspace in organization: ${org.name || organizationId}`);
                        break;
                    }
                } catch (wsError) {
                    // Continue searching in other organizations
                }
            }
            
            if (!organizationId || !workspaceFound) {
                console.error(`❌ Workspace ${workspaceId} not found in any organization`);
                console.error('   Make sure you have access to this workspace.');
                console.error('   Tip: You can speed up this process by providing the organization ID with --org');
                return [];
            }
        }
        
        // Now get projects from the workspace
        const projectsResponse = await api.get(`/organizations/${organizationId}/workspaces/${workspaceId}/projects`);
        const projects = projectsResponse.data || [];
        
        console.log(`✅ Found ${projects.length} projects in workspace`);
        return projects;
        
    } catch (error) {
        if (error.response && error.response.status === 404) {
            console.error(`❌ Workspace ${workspaceId} not found`);
            console.error('   The workspace might not exist or you don\'t have access to it.');
        } else if (error.response && error.response.status === 401) {
            console.error('❌ Authentication failed');
            console.error('   Please check your credentials.');
        } else {
            console.error(`❌ Failed to fetch projects for workspace ${workspaceId}`);
            console.error(`   Error: ${error.message}`);
        }
        return [];
    }
}

// Check single project health
async function checkProjectHealth(api, projectId, options) {
    console.log(`\n🔍 Checking health for project ${projectId}...`);
    
    try {
        const stats = await getProjectStats(api, projectId);
        const health = calculateHealthScore(stats.project, stats);
        
        // If project doesn't have basic info, provide minimal details
        if (!stats.project.title) {
            stats.project.title = 'Untitled Project';
        }
        if (!stats.project.status) {
            stats.project.status = 'UNKNOWN';
        }
        
        // Display results
        console.log(`\n📊 Project: ${stats.project.title}`);
        console.log(`   ID: ${projectId}`);
        console.log(`   Status: ${stats.project.status}`);
        console.log(`   Created: ${new Date(stats.project.created_at).toLocaleDateString()}`);
        
        console.log(`\n🏥 Health Score: ${health.score}/100 (Grade: ${health.grade})`);
        console.log('━'.repeat(60));
        
        // Group results by category
        const categories = {
            critical: [],
            major: [],
            minor: []
        };
        
        for (const [key, result] of Object.entries(health.results)) {
            categories[result.category].push(result);
        }
        
        // Display results by category
        if (categories.critical.length > 0) {
            console.log('\n🚨 Critical Issues:');
            categories.critical.forEach(r => console.log(`   ${r.message}`));
        }
        
        if (categories.major.length > 0) {
            console.log('\n⚠️  Major Issues:');
            categories.major.forEach(r => console.log(`   ${r.message}`));
        }
        
        if (categories.minor.length > 0) {
            console.log('\n📝 Minor Issues:');
            categories.minor.forEach(r => console.log(`   ${r.message}`));
        }
        
        // Statistics summary
        console.log('\n📈 Statistics:');
        console.log(`   Total Conversations: ${stats.totalConversations}`);
        console.log(`   Completed: ${stats.digestedConversations} (${stats.completionRate.toFixed(1)}%)`);
        console.log(`   Abandoned: ${stats.abandonedConversations}`);
        console.log(`   Failed: ${stats.failedConversations}`);
        
        return {
            projectId,
            title: stats.project.title,
            health,
            stats
        };
        
    } catch (error) {
        console.error(`❌ Failed to check health for project ${projectId}: ${error.message}`);
        return {
            projectId,
            error: error.message
        };
    }
}

// Main health check function
async function healthCheck(api, options) {
    try {
        const results = [];
        let projectsToCheck = [];
        
        // Determine which projects to check
        if (options.projectId) {
            // Single project
            projectsToCheck = [{ _id: options.projectId, id: options.projectId }];
        } else if (options.workspaceId) {
            // All projects in workspace
            projectsToCheck = await getWorkspaceProjects(api, options.workspaceId, options.organizationId);
            if (projectsToCheck.length > 0) {
                console.log(`Found ${projectsToCheck.length} projects in workspace`);
            }
        } else {
            console.error('❌ Please specify either a project ID (-p) or workspace ID (-w)');
            return;
        }
        
        // Check each project
        for (const project of projectsToCheck) {
            const projectId = project._id || project.id;
            const result = await checkProjectHealth(api, projectId, options);
            results.push(result);
            
            // Add delay between checks
            if (options.delay > 0 && projectsToCheck.indexOf(project) < projectsToCheck.length - 1) {
                await new Promise(resolve => setTimeout(resolve, options.delay));
            }
        }
        
        // Generate summary report
        if (results.length > 1) {
            console.log(`\n${'='.repeat(80)}`);
            console.log('HEALTH CHECK SUMMARY');
            console.log(`${'='.repeat(80)}`);
            
            // Sort by health score
            const successfulResults = results.filter(r => !r.error);
            const failedResults = results.filter(r => r.error);
            
            successfulResults.sort((a, b) => a.health.score - b.health.score);
            
            console.log(`\nTotal Projects Checked: ${results.length}`);
            console.log(`Successful Checks: ${successfulResults.length}`);
            console.log(`Failed Checks: ${failedResults.length}`);
            
            if (successfulResults.length > 0) {
                // Grade distribution
                const gradeDistribution = {A: 0, B: 0, C: 0, D: 0, F: 0};
                successfulResults.forEach(r => gradeDistribution[r.health.grade]++);
                
                console.log('\nGrade Distribution:');
                Object.entries(gradeDistribution).forEach(([grade, count]) => {
                    if (count > 0) {
                        const percentage = (count / successfulResults.length * 100).toFixed(0);
                        console.log(`   ${grade}: ${count} projects (${percentage}%)`);
                    }
                });
                
                // Show worst performing projects
                console.log('\n🚨 Projects Needing Attention:');
                successfulResults.slice(0, 5).forEach(r => {
                    console.log(`   ${r.title} (Score: ${r.health.score}/100) - ID: ${r.projectId}`);
                });
                
                // Average score
                const avgScore = successfulResults.reduce((sum, r) => sum + r.health.score, 0) / successfulResults.length;
                console.log(`\nAverage Health Score: ${avgScore.toFixed(1)}/100`);
            }
            
            if (failedResults.length > 0) {
                console.log('\n❌ Failed Checks:');
                failedResults.forEach(r => {
                    console.log(`   Project ${r.projectId}: ${r.error}`);
                });
            }
        }
        
        // Export report if requested
        if (options.export) {
            const reportPath = path.join(
                options.outputDir,
                `health-check-${new Date().toISOString().split('T')[0]}.json`
            );
            
            // Create output directory if it doesn't exist
            if (!fs.existsSync(options.outputDir)) {
                fs.mkdirSync(options.outputDir, { recursive: true });
            }
            
            const report = {
                checkDate: new Date().toISOString(),
                summary: {
                    totalProjects: results.length,
                    successful: results.filter(r => !r.error).length,
                    failed: results.filter(r => r.error).length,
                    averageScore: results.filter(r => !r.error).reduce((sum, r) => sum + r.health.score, 0) / results.filter(r => !r.error).length || 0
                },
                results: results.map(r => ({
                    projectId: r.projectId,
                    title: r.title,
                    score: r.health?.score,
                    grade: r.health?.grade,
                    issues: r.health?.results,
                    stats: r.stats,
                    error: r.error
                }))
            };
            
            fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
            console.log(`\n📄 Report exported to: ${reportPath}`);
        }
        
    } catch (error) {
        console.error('Error during health check:', error);
        throw error;
    }
}

module.exports = {
    healthCheck
};