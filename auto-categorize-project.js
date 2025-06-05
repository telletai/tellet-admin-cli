#!/usr/bin/env node

const axios = require('axios');
const { program } = require('commander');

// Configuration
const API_BASE_URL = process.env.TELLET_API_URL || 'https://api.tellet.ai';
const API_ENDPOINTS = {
  login: '/users/login',
  projects: '/dashboard/projects',  // This might not work without org/workspace IDs
  analysis: '/analyzer/results',
  categoriesAI: '/analyzer/categorization',
  categoriesGet: '/analyzer/categorization',
  interviewQuestions: '/analyzer/results',  // Alternative way to get project info
};

// Axios instance with interceptor for auth
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
let authToken = null;
api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

// Add response interceptor for debugging
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.error(`API Error: ${error.response.status} ${error.response.statusText}`);
      console.error(`URL: ${error.config.method.toUpperCase()} ${error.config.url}`);
      if (error.response.status === 404) {
        console.error('Endpoint not found. The API structure might be different on staging.');
      }
    }
    return Promise.reject(error);
  }
);

// Utility functions
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function login(email, password) {
  try {
    console.log('🔐 Authenticating...');
    const response = await api.post(API_ENDPOINTS.login, {
      email,
      password,
    });
    
    authToken = response.data.token || response.data.access_token;
    console.log('✅ Authentication successful');
    return authToken;
  } catch (error) {
    console.error('❌ Authentication failed:', error.response?.data?.message || error.message);
    throw error;
  }
}

async function getProject(projectId) {
  try {
    // Get project info from analyzer results endpoint
    const resultsResponse = await api.get(`${API_ENDPOINTS.interviewQuestions}/${projectId}/interview_questions`);
    
    if (resultsResponse.data) {
      // The response is an array of questions directly
      const questions = Array.isArray(resultsResponse.data) ? resultsResponse.data : [];
      
      // Convert the simple format to full format with label
      const interview_questions = questions.map(q => ({
        id: q.id,
        label: q.question,
        question: q.question
      }));
      
      return {
        _id: projectId,
        name: 'Project ' + projectId.slice(-6), // Use last 6 chars of ID as name
        status: 'PUBLISHED', // Assume published if we can access it
        interview_questions: interview_questions,
      };
    }
    throw new Error('No project data returned');
  } catch (error) {
    console.error('❌ Failed to fetch project:', error.response?.data?.message || error.message);
    throw error;
  }
}

async function getAnalysis(projectId) {
  try {
    const response = await api.get(`${API_ENDPOINTS.analysis}/${projectId}`);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to fetch analysis:', error.response?.data?.message || error.message);
    throw error;
  }
}

async function getCategories(projectId, questionId) {
  try {
    const response = await api.get(`${API_ENDPOINTS.categoriesGet}/${projectId}/question/${questionId}`);
    // The response from getCat has this structure:
    // { conversations_num, last_ran, categories, categories_multi }
    if (response.data && response.data.categories) {
      return response.data.categories;
    }
    // Fallback for array response
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    if (error.response?.status === 404) {
      // No categories found for this question
      return [];
    }
    console.error('❌ Failed to fetch categories:', error.response?.data?.message || error.message);
    throw error;
  }
}

async function generateAICategories(projectId, questionId) {
  try {
    console.log(`  🤖 Generating AI categories...`);
    
    // question_id is a query parameter, not body
    const response = await api.post(`${API_ENDPOINTS.categoriesAI}/${projectId}/ai?question_id=${questionId}`);
    return response.data;
  } catch (error) {
    console.error('  ❌ Failed to generate AI categories:', error.response?.data?.message || error.message);
    throw error;
  }
}

async function runCategorization(projectId, questionId, categories, categoryType) {
  try {
    console.log(`  🏃 Running categorization...`);
    // category_type is a query parameter, not in body
    const response = await api.post(`${API_ENDPOINTS.categoriesAI}/${projectId}?category_type=${categoryType}`, {
      question_id: questionId,
      categories: categories.map(cat => ({
        label: cat.label,
        prompt: cat.prompt,
        color: cat.color,
      })),
    });
    return response.data;
  } catch (error) {
    console.error('  ❌ Failed to run categorization:', error.response?.data?.message || error.message);
    throw error;
  }
}

async function processProject(projectId, options) {
  try {
    // Validate project ID format (MongoDB ObjectId should be 24 hex characters)
    if (!/^[a-fA-F0-9]{24}$/.test(projectId)) {
      throw new Error(`Invalid project ID format: "${projectId}". MongoDB ObjectId should be 24 hexadecimal characters.`);
    }
    
    // Get project details
    console.log(`\n📋 Fetching project ${projectId}...`);
    const project = await getProject(projectId);
    console.log(`✅ Found project: ${project.name}`);
    console.log(`   Status: ${project.status}`);
    console.log(`   Questions: ${project.interview_questions.length}`);

    // Check project status
    if (!['PUBLISHED', 'COMPLETED'].includes(project.status)) {
      throw new Error(`Project must be published or completed. Current status: ${project.status}`);
    }

    // Check if project has questions
    if (!project.interview_questions || project.interview_questions.length === 0) {
      console.log('\n⚠️  Warning: Project has no interview questions.');
      console.log('   This might mean:');
      console.log('   1. The project ID is incorrect');
      console.log('   2. You don\'t have access to this project');
      console.log('   3. The project hasn\'t been set up with questions yet');
      console.log('   4. The API response format is different than expected');
      
      // Try to get more info
      console.log('\n   Attempting to get overall results...');
      try {
        const overallResponse = await api.get(`${API_ENDPOINTS.analysis}/${projectId}/overall`);
        console.log('   Overall results found:', overallResponse.data);
      } catch (e) {
        console.log('   Could not fetch overall results');
      }
      
      throw new Error('No interview questions found in project');
    }

    // Skip analysis fetch - we don't need it for categorization
    
    // Process each question
    let questionsProcessed = 0;
    let questionsSkipped = 0;
    let errors = 0;

    console.log(`\n🔄 Processing questions...`);
    for (const question of project.interview_questions) {
      console.log(`\n📝 Question: "${question.label}" (ID: ${question.id})`);
      
      try {
        // Check if question already has categories
        const existingCategories = await getCategories(projectId, question.id);
        
        if (existingCategories && existingCategories.length > 0) {
          console.log(`  ⏭️  Already has ${existingCategories.length} categories. Skipping...`);
          if (options.verbose) {
            console.log(`     Existing categories:`);
            existingCategories.forEach(cat => {
              console.log(`     - ${cat.label}: ${cat.count || 0} conversations`);
            });
          }
          questionsSkipped++;
          continue;
        }

        if (options.dryRun) {
          console.log(`  🔍 [DRY RUN] Would generate AI categories for this question`);
          questionsProcessed++;
          continue;
        }

        // Generate AI categories
        const aiResult = await generateAICategories(projectId, question.id);
        console.log(`  ✅ Generated ${aiResult.categories.length} categories (Type: ${aiResult.category_type})`);
        
        if (options.verbose) {
          aiResult.categories.forEach(cat => {
            console.log(`     - ${cat.label}: ${cat.prompt} (${cat.color})`);
          });
        }

        // Run categorization with the generated categories
        if (!options.skipRun) {
          await runCategorization(projectId, question.id, aiResult.categories, aiResult.category_type);
          console.log(`  ✅ Categorization completed`);
        }

        questionsProcessed++;

        // Add delay between questions to avoid rate limiting
        if (options.delay > 0) {
          await delay(options.delay);
        }

      } catch (error) {
        console.error(`  ❌ Error processing question: ${error.message}`);
        errors++;
        
        if (!options.continueOnError) {
          throw error;
        }
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Auto-categorization Summary');
    console.log('='.repeat(50));
    console.log(`Project: ${project.name} (${projectId})`);
    console.log(`Total questions: ${project.interview_questions.length}`);
    console.log(`Questions processed: ${questionsProcessed}`);
    console.log(`Questions skipped: ${questionsSkipped}`);
    console.log(`Errors: ${errors}`);
    
    if (options.dryRun) {
      console.log('\n🔍 [DRY RUN MODE - No changes were made]');
    }

  } catch (error) {
    console.error('\n❌ Failed to process project:', error.message);
    throw error;
  }
}

// CLI setup
program
  .name('auto-categorize-project')
  .description('Automatically generate AI categories for Tellet project questions')
  .version('1.0.0')
  .requiredOption('-p, --project <id>', 'Project ID to process')
  .requiredOption('-e, --email <email>', 'Email for authentication')
  .requiredOption('-P, --password <password>', 'Password for authentication')
  .option('-u, --url <url>', 'API base URL', 'https://api-staging.tellet.ai')
  .option('-d, --dry-run', 'Run in dry mode without making changes', false)
  .option('-v, --verbose', 'Show detailed output', false)
  .option('--skip-run', 'Generate categories but skip running categorization', false)
  .option('--delay <ms>', 'Delay between questions in milliseconds', parseInt, 1000)
  .option('--continue-on-error', 'Continue processing even if a question fails', false)
  .action(async (options) => {
    try {
      // Set API URL if provided
      if (options.url) {
        api.defaults.baseURL = options.url;
      }

      // Authenticate
      await login(options.email, options.password);

      // Process the project
      await processProject(options.project, options);

      console.log('\n✅ Auto-categorization completed successfully!');
      process.exit(0);
    } catch (error) {
      console.error('\n❌ Auto-categorization failed:', error.message);
      if (options.verbose && error.response) {
        console.error('Response data:', error.response.data);
      }
      process.exit(1);
    }
  });

program.parse();