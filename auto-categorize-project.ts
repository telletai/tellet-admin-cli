#!/usr/bin/env ts-node

import axios, { AxiosInstance } from 'axios';
import { program } from 'commander';

// Types
interface LoginResponse {
  access_token: string;
}

interface Project {
  _id: string;
  name: string;
  status: 'DRAFT' | 'PUBLISHED' | 'COMPLETED' | 'ARCHIVED';
  interview_questions: InterviewQuestion[];
}

interface InterviewQuestion {
  id: string;
  label: string;
}

interface Category {
  id?: string;
  label: string;
  prompt: string;
  color: string;
}

interface AIGenerateResponse {
  categories: Category[];
  category_type: 'single' | 'multi';
}

interface CliOptions {
  project: string;
  email: string;
  password: string;
  url: string;
  dryRun: boolean;
  verbose: boolean;
  skipRun: boolean;
  delay: number;
  continueOnError: boolean;
}

// Configuration
const API_ENDPOINTS = {
  login: '/dashboard/auth/login',
  projects: '/dashboard/projects',
  analysis: '/analyzer/analysis',
  categoriesAI: '/analyzer/categorization',
  categoriesGet: '/analyzer/categorization',
};

class TelletAutoCategorizer {
  private api: AxiosInstance;
  private authToken: string | null = null;

  constructor(baseURL: string) {
    this.api = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth interceptor
    this.api.interceptors.request.use((config) => {
      if (this.authToken) {
        config.headers.Authorization = `Bearer ${this.authToken}`;
      }
      return config;
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async login(email: string, password: string): Promise<string> {
    try {
      console.log('🔐 Authenticating...');
      const response = await this.api.post<LoginResponse>(API_ENDPOINTS.login, {
        email,
        password,
      });
      
      this.authToken = response.data.access_token;
      console.log('✅ Authentication successful');
      return this.authToken;
    } catch (error: any) {
      console.error('❌ Authentication failed:', error.response?.data?.message || error.message);
      throw error;
    }
  }

  async getProject(projectId: string): Promise<Project> {
    try {
      const response = await this.api.get<Project>(`${API_ENDPOINTS.projects}/${projectId}`);
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to fetch project:', error.response?.data?.message || error.message);
      throw error;
    }
  }

  async getCategories(projectId: string, questionId: string): Promise<Category[]> {
    try {
      const response = await this.api.get<Category[]>(
        `${API_ENDPOINTS.categoriesGet}/${projectId}/question/${questionId}`
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return [];
      }
      console.error('❌ Failed to fetch categories:', error.response?.data?.message || error.message);
      throw error;
    }
  }

  async generateAICategories(projectId: string, questionId: string): Promise<AIGenerateResponse> {
    try {
      console.log(`  🤖 Generating AI categories...`);
      const response = await this.api.post<AIGenerateResponse>(
        `${API_ENDPOINTS.categoriesAI}/${projectId}/ai`,
        { question_id: questionId }
      );
      return response.data;
    } catch (error: any) {
      console.error('  ❌ Failed to generate AI categories:', error.response?.data?.message || error.message);
      throw error;
    }
  }

  async runCategorization(
    projectId: string,
    questionId: string,
    categories: Category[],
    categoryType: string
  ): Promise<any> {
    try {
      console.log(`  🏃 Running categorization...`);
      const response = await this.api.post(`${API_ENDPOINTS.categoriesAI}/${projectId}`, {
        question_id: questionId,
        categories: categories.map(cat => ({
          label: cat.label,
          prompt: cat.prompt,
          color: cat.color,
        })),
        category_type: categoryType,
      });
      return response.data;
    } catch (error: any) {
      console.error('  ❌ Failed to run categorization:', error.response?.data?.message || error.message);
      throw error;
    }
  }

  async processProject(projectId: string, options: CliOptions): Promise<void> {
    try {
      // Get project details
      console.log(`\n📋 Fetching project ${projectId}...`);
      const project = await this.getProject(projectId);
      console.log(`✅ Found project: ${project.name}`);
      console.log(`   Status: ${project.status}`);
      console.log(`   Questions: ${project.interview_questions.length}`);

      // Check project status
      if (!['PUBLISHED', 'COMPLETED'].includes(project.status)) {
        throw new Error(`Project must be published or completed. Current status: ${project.status}`);
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
          const existingCategories = await this.getCategories(projectId, question.id);
          
          if (existingCategories.length > 0) {
            console.log(`  ⏭️  Already has ${existingCategories.length} categories. Skipping...`);
            questionsSkipped++;
            continue;
          }

          if (options.dryRun) {
            console.log(`  🔍 [DRY RUN] Would generate AI categories for this question`);
            questionsProcessed++;
            continue;
          }

          // Generate AI categories
          const aiResult = await this.generateAICategories(projectId, question.id);
          console.log(`  ✅ Generated ${aiResult.categories.length} categories (Type: ${aiResult.category_type})`);
          
          if (options.verbose) {
            aiResult.categories.forEach(cat => {
              console.log(`     - ${cat.label}: ${cat.prompt} (${cat.color})`);
            });
          }

          // Run categorization with the generated categories
          if (!options.skipRun) {
            await this.runCategorization(projectId, question.id, aiResult.categories, aiResult.category_type);
            console.log(`  ✅ Categorization completed`);
          }

          questionsProcessed++;

          // Add delay between questions
          if (options.delay > 0) {
            await this.delay(options.delay);
          }

        } catch (error: any) {
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

    } catch (error: any) {
      console.error('\n❌ Failed to process project:', error.message);
      throw error;
    }
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
  .action(async (options: CliOptions) => {
    try {
      const categorizer = new TelletAutoCategorizer(options.url);

      // Authenticate
      await categorizer.login(options.email, options.password);

      // Process the project
      await categorizer.processProject(options.project, options);

      console.log('\n✅ Auto-categorization completed successfully!');
      process.exit(0);
    } catch (error: any) {
      console.error('\n❌ Auto-categorization failed:', error.message);
      if (options.verbose && error.response) {
        console.error('Response data:', error.response.data);
      }
      process.exit(1);
    }
  });

program.parse();