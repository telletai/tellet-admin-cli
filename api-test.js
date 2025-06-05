// Simple color functions for console output (no dependencies needed)
const color = {
    green: (s) => s,
    red: (s) => s,
    yellow: (s) => s,
    blue: (s) => s
};

// List of all API endpoints used in the admin tool
const API_ENDPOINTS = [
    // Dashboard endpoints - require org/workspace context
    {
        name: 'Dashboard - List Organizations',
        method: 'GET',
        path: '/organizations',
        description: 'Get all organizations for user'
    },
    {
        name: 'Dashboard - List Workspaces',
        method: 'GET',
        path: '/organizations/:organizationId/workspaces',
        description: 'Get workspaces in organization',
        requiresParam: true,
        paramName: 'organizationId'
    },
    {
        name: 'Dashboard - List Projects',
        method: 'GET',
        path: '/organizations/:organizationId/workspaces/:workspaceId/projects',
        description: 'Get projects in workspace',
        requiresParam: true,
        paramName: 'organizationId',
        secondParam: 'workspaceId'
    },
    {
        name: 'Dashboard - Get Project',
        method: 'GET',
        path: '/organizations/:organizationId/workspaces/:workspaceId/projects/:projectId',
        description: 'Get specific project details',
        requiresParam: true,
        paramName: 'organizationId',
        secondParam: 'workspaceId',
        thirdParam: 'projectId'
    },
    
    // Analyzer endpoints
    {
        name: 'Analyzer - Get Conversations',
        method: 'GET',
        path: '/analyzer/results/:projectId/conversations',
        description: 'Get all conversations for a project',
        requiresParam: true,
        paramName: 'projectId'
    },
    {
        name: 'Analyzer - Get Conversation Details',
        method: 'GET',
        path: '/analyzer/results/:projectId/conversations/:conversationId',
        description: 'Get specific conversation with messages',
        requiresParam: true,
        paramName: 'projectId',
        secondParam: 'conversationId'
    },
    {
        name: 'Analyzer - Get Interview Questions',
        method: 'GET',
        path: '/analyzer/results/:projectId/interview_questions',
        description: 'Get interview questions for a project',
        requiresParam: true,
        paramName: 'projectId'
    },
    {
        name: 'Analyzer - Get Questions (Alt)',
        method: 'GET',
        path: '/analyzer/results/:projectId/questions',
        description: 'Alternative endpoint for questions',
        requiresParam: true,
        paramName: 'projectId'
    },
    {
        name: 'Analyzer - Get Categories',
        method: 'GET',
        path: '/analyzer/categorization/:projectId',
        description: 'Get all categories for a project',
        requiresParam: true,
        paramName: 'projectId'
    },
    {
        name: 'Analyzer - Get Question Categories',
        method: 'GET',
        path: '/analyzer/categorization/:projectId/question/:questionId',
        description: 'Get categories for specific question',
        requiresParam: true,
        paramName: 'projectId',
        secondParam: 'questionId'
    },
    {
        name: 'Analyzer - Export All Conversations',
        method: 'GET',
        path: '/analyzer/results/per_respondent/export_all/:projectId',
        description: 'Export all conversations as CSV',
        requiresParam: true,
        paramName: 'projectId'
    },
    {
        name: 'Analyzer - Export Overview',
        method: 'GET',
        path: '/analyzer/results/per_conversation/export/:projectId',
        description: 'Export conversation overview as CSV',
        requiresParam: true,
        paramName: 'projectId'
    },
    
    // Worker endpoints
    {
        name: 'Worker - Get Chat History',
        method: 'GET',
        path: '/chat/history/:conversationId',
        description: 'Get chat history with signed media URLs',
        requiresParam: true,
        paramName: 'conversationId'
    }
];

async function testEndpoint(api, endpoint, testProjectId, testWorkspaceId, testConversationId, testOrganizationId) {
    try {
        let path = endpoint.path;
        
        // Replace parameters if needed
        if (endpoint.requiresParam) {
            // Handle organization ID first
            if (endpoint.paramName === 'organizationId' && testOrganizationId) {
                path = path.replace(':organizationId', testOrganizationId);
            } else if (endpoint.paramName === 'organizationId') {
                return {
                    endpoint: endpoint.name,
                    status: 'SKIPPED',
                    message: 'Requires organizationId parameter'
                };
            }
            
            // Handle other primary parameters
            if (endpoint.paramName === 'projectId' && testProjectId) {
                path = path.replace(':projectId', testProjectId);
            } else if (endpoint.paramName === 'workspaceId' && testWorkspaceId) {
                path = path.replace(':workspaceId', testWorkspaceId);
            } else if (endpoint.paramName === 'conversationId' && testConversationId) {
                path = path.replace(':conversationId', testConversationId);
            } else if (endpoint.paramName !== 'organizationId') {
                return {
                    endpoint: endpoint.name,
                    status: 'SKIPPED',
                    message: `Requires ${endpoint.paramName} parameter`
                };
            }
            
            // Handle second parameter if exists
            if (endpoint.secondParam === 'workspaceId' && testWorkspaceId) {
                path = path.replace(':workspaceId', testWorkspaceId);
            } else if (endpoint.secondParam === 'conversationId' && testConversationId) {
                path = path.replace(':conversationId', testConversationId);
            } else if (endpoint.secondParam === 'questionId') {
                // Skip question-specific endpoints for now
                return {
                    endpoint: endpoint.name,
                    status: 'SKIPPED',
                    message: 'Requires questionId parameter'
                };
            } else if (endpoint.secondParam && endpoint.secondParam !== 'workspaceId') {
                return {
                    endpoint: endpoint.name,
                    status: 'SKIPPED',
                    message: `Requires ${endpoint.secondParam} parameter`
                };
            }
            
            // Handle third parameter if exists
            if (endpoint.thirdParam === 'projectId' && testProjectId) {
                path = path.replace(':projectId', testProjectId);
            } else if (endpoint.thirdParam) {
                return {
                    endpoint: endpoint.name,
                    status: 'SKIPPED',
                    message: `Requires ${endpoint.thirdParam} parameter`
                };
            }
        }
        
        const startTime = Date.now();
        const response = await api({
            method: endpoint.method,
            url: path,
            timeout: 10000 // 10 second timeout
        });
        const responseTime = Date.now() - startTime;
        
        return {
            endpoint: endpoint.name,
            status: 'SUCCESS',
            statusCode: response.status,
            responseTime: `${responseTime}ms`,
            dataReceived: response.data ? 
                (Array.isArray(response.data) ? `Array(${response.data.length})` : 'Object') : 
                'No data'
        };
        
    } catch (error) {
        return {
            endpoint: endpoint.name,
            status: 'FAILED',
            statusCode: error.response?.status || 'N/A',
            error: error.response?.data?.message || error.message
        };
    }
}

async function testAllEndpoints(api, options) {
    console.log('\n🔍 Testing Tellet API Endpoints');
    console.log('='.repeat(80));
    
    if (options.projectId) {
        console.log(`Test Project ID: ${options.projectId}`);
    }
    if (options.workspaceId) {
        console.log(`Test Workspace ID: ${options.workspaceId}`);
    }
    if (options.conversationId) {
        console.log(`Test Conversation ID: ${options.conversationId}`);
    }
    
    console.log('='.repeat(80));
    console.log('\nTesting endpoints...\n');
    
    const results = {
        dashboard: [],
        analyzer: [],
        worker: [],
        other: []
    };
    
    // If no IDs provided, try to get them
    let testProjectId = options.projectId;
    let testWorkspaceId = options.workspaceId;
    let testConversationId = options.conversationId;
    let testOrganizationId = options.organizationId;
    
    // Try to get organization ID first - it's needed for dashboard endpoints
    if (!testOrganizationId) {
        try {
            const orgsResponse = await api.get('/organizations');
            if (orgsResponse.data && orgsResponse.data.length > 0) {
                testOrganizationId = orgsResponse.data[0]._id || orgsResponse.data[0].id;
                console.log(`✅ Found test organization: ${testOrganizationId}`);
                
                // Also get first workspace from this org
                if (!testWorkspaceId) {
                    const workspacesResponse = await api.get(`/organizations/${testOrganizationId}/workspaces`);
                    console.log('   Workspaces response type:', Array.isArray(workspacesResponse.data) ? 'Array' : typeof workspacesResponse.data);
                    
                    // Handle different response formats
                    let workspaces = [];
                    if (Array.isArray(workspacesResponse.data)) {
                        workspaces = workspacesResponse.data;
                    } else if (workspacesResponse.data && (workspacesResponse.data.priv || workspacesResponse.data.shared)) {
                        // Response contains priv and shared arrays
                        workspaces = [
                            ...(workspacesResponse.data.priv || []),
                            ...(workspacesResponse.data.shared || [])
                        ];
                        console.log(`   Found ${workspacesResponse.data.priv?.length || 0} private and ${workspacesResponse.data.shared?.length || 0} shared workspaces`);
                    } else if (workspacesResponse.data && workspacesResponse.data.workspaces) {
                        workspaces = workspacesResponse.data.workspaces;
                    }
                    
                    if (workspaces.length > 0) {
                        testWorkspaceId = workspaces[0]._id || workspaces[0].id;
                        console.log(`✅ Found test workspace: ${testWorkspaceId}`);
                        
                        // Also get first project from this workspace
                        if (!testProjectId) {
                            const projectsResponse = await api.get(`/organizations/${testOrganizationId}/workspaces/${testWorkspaceId}/projects`);
                            if (projectsResponse.data && projectsResponse.data.length > 0) {
                                testProjectId = projectsResponse.data[0]._id || projectsResponse.data[0].id;
                                console.log(`✅ Found test project: ${testProjectId}`);
                            }
                        }
                    } else {
                        console.log('   No workspaces found in response');
                    }
                }
            }
        } catch (error) {
            console.log('⚠️  Could not auto-detect organization/workspace/project IDs');
            if (error.response) {
                console.log(`   Error: ${error.response.status} - ${error.response.data?.message || error.message}`);
            } else {
                console.log(`   Error: ${error.message}`);
            }
        }
    }
    
    // Try to get a conversation ID if not provided
    if (!testConversationId && testProjectId) {
        try {
            const conversationsResponse = await api.get(`/analyzer/results/${testProjectId}/conversations`);
            if (conversationsResponse.data && conversationsResponse.data.length > 0) {
                testConversationId = conversationsResponse.data[0]._id || conversationsResponse.data[0].id;
                console.log(`✅ Found test conversation: ${testConversationId}`);
            }
        } catch (error) {
            console.log('⚠️  Could not auto-detect conversation ID');
        }
    }
    
    console.log('\n' + '='.repeat(80) + '\n');
    
    // Test each endpoint
    for (const endpoint of API_ENDPOINTS) {
        const result = await testEndpoint(api, endpoint, testProjectId, testWorkspaceId, testConversationId, testOrganizationId);
        
        // Categorize results
        if (endpoint.path.startsWith('/dashboard')) {
            results.dashboard.push(result);
        } else if (endpoint.path.startsWith('/analyzer')) {
            results.analyzer.push(result);
        } else if (endpoint.path.startsWith('/chat') || endpoint.path.startsWith('/worker')) {
            results.worker.push(result);
        } else {
            results.other.push(result);
        }
        
        // Print result
        const icon = result.status === 'SUCCESS' ? '✅' : 
                    result.status === 'FAILED' ? '❌' : '⏭️';
        // We don't actually use colors since chalk isn't installed
        
        console.log(`${icon} ${result.endpoint}`);
        if (result.status === 'SUCCESS') {
            console.log(`   Status: ${result.statusCode} | Time: ${result.responseTime} | Data: ${result.dataReceived}`);
        } else if (result.status === 'FAILED') {
            console.log(`   Status: ${result.statusCode} | Error: ${result.error}`);
        } else {
            console.log(`   ${result.message}`);
        }
        
        // Add delay between requests
        await new Promise(resolve => setTimeout(resolve, options.delay || 100));
    }
    
    // Print summary
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    
    const printCategoryResults = (category, results) => {
        const success = results.filter(r => r.status === 'SUCCESS').length;
        const failed = results.filter(r => r.status === 'FAILED').length;
        const skipped = results.filter(r => r.status === 'SKIPPED').length;
        
        console.log(`\n${category}:`);
        console.log(`  ✅ Success: ${success}`);
        console.log(`  ❌ Failed: ${failed}`);
        console.log(`  ⏭️  Skipped: ${skipped}`);
        
        if (failed > 0) {
            console.log(`\n  Failed endpoints:`);
            results.filter(r => r.status === 'FAILED').forEach(r => {
                console.log(`    - ${r.endpoint}: ${r.error}`);
            });
        }
    };
    
    printCategoryResults('Dashboard Endpoints', results.dashboard);
    printCategoryResults('Analyzer Endpoints', results.analyzer);
    printCategoryResults('Worker Endpoints', results.worker);
    if (results.other.length > 0) {
        printCategoryResults('Other Endpoints', results.other);
    }
    
    // Export detailed report if requested
    if (options.export) {
        const reportPath = path.join(
            options.outputDir,
            `api-test-${new Date().toISOString().split('T')[0]}.json`
        );
        
        // Create output directory if it doesn't exist
        if (!fs.existsSync(options.outputDir)) {
            fs.mkdirSync(options.outputDir, { recursive: true });
        }
        
        const report = {
            testDate: new Date().toISOString(),
            testParameters: {
                projectId: testProjectId,
                workspaceId: testWorkspaceId,
                conversationId: testConversationId
            },
            results: {
                dashboard: results.dashboard,
                analyzer: results.analyzer,
                worker: results.worker,
                other: results.other
            },
            summary: {
                total: API_ENDPOINTS.length,
                success: Object.values(results).flat().filter(r => r.status === 'SUCCESS').length,
                failed: Object.values(results).flat().filter(r => r.status === 'FAILED').length,
                skipped: Object.values(results).flat().filter(r => r.status === 'SKIPPED').length
            }
        };
        
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\n📄 Detailed report exported to: ${reportPath}`);
    }
}

module.exports = {
    testAllEndpoints
};