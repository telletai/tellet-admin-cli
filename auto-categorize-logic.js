// Auto-categorization logic module
const API_ENDPOINTS = {
  interviewQuestions: '/analyzer/results',
  categoriesAI: '/analyzer/categorization',
  categoriesGet: '/analyzer/categorization',
};

async function getProject(api, projectId) {
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

async function getCategories(api, projectId, questionId) {
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

async function generateAICategories(api, projectId, questionId) {
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

async function runCategorization(api, projectId, questionId, categories, categoryType) {
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

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function processProject(api, projectId, options) {
  try {
    // Validate project ID format (MongoDB ObjectId should be 24 hex characters)
    if (!/^[a-fA-F0-9]{24}$/.test(projectId)) {
      throw new Error(`Invalid project ID format: "${projectId}". MongoDB ObjectId should be 24 hexadecimal characters.`);
    }
    
    // Get project details
    console.log(`\n📋 Fetching project ${projectId}...`);
    const project = await getProject(api, projectId);
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
      throw new Error('No interview questions found in project');
    }

    // Process each question
    let questionsProcessed = 0;
    let questionsSkipped = 0;
    let errors = 0;

    console.log(`\n🔄 Processing questions...`);
    for (const question of project.interview_questions) {
      console.log(`\n📝 Question: "${question.label}" (ID: ${question.id})`);
      
      try {
        // Check if question already has categories
        const existingCategories = await getCategories(api, projectId, question.id);
        
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
        const aiResult = await generateAICategories(api, projectId, question.id);
        console.log(`  ✅ Generated ${aiResult.categories.length} categories (Type: ${aiResult.category_type})`);
        
        if (options.verbose) {
          aiResult.categories.forEach(cat => {
            console.log(`     - ${cat.label}: ${cat.prompt} (${cat.color})`);
          });
        }

        // Run categorization with the generated categories
        if (!options.skipRun) {
          await runCategorization(api, projectId, question.id, aiResult.categories, aiResult.category_type);
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

module.exports = {
  processProject,
  getProject,
  getCategories,
  generateAICategories,
  runCategorization
};