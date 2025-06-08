const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const pipeline = promisify(require('stream').pipeline);

// Helper function to format timestamp to a readable format
function formatDate(timestamp) {
    if (!timestamp) return "Unknown";
    
    const date = new Date(timestamp);
    return date.toISOString().replace('T', ' ').substring(0, 19);
}

// Helper to extract metadata
function extractMetadata(conversation) {
    const metadata = {
        created: formatDate(conversation.created_at),
        updated: formatDate(conversation.updated_at),
        participantId: conversation.user_id || "Unknown",
        duration: "Unknown"
    };
    
    // Try to calculate duration if timestamps are available in messages
    if (conversation.messages && conversation.messages.length > 1) {
        const firstMsg = conversation.messages[0];
        const lastMsg = conversation.messages[conversation.messages.length - 1];
        
        if (firstMsg.created_at && lastMsg.created_at) {
            const startTime = new Date(firstMsg.created_at);
            const endTime = new Date(lastMsg.created_at);
            const durationMs = endTime - startTime;
            const durationMins = Math.round(durationMs / 60000);
            metadata.duration = `${durationMins} minutes`;
        }
    }
    
    return metadata;
}

// Helper function to sanitize filename
function sanitizeFilename(text, maxLength = 50) {
    return text
        .replace(/[^\w\s-]/g, '') // Remove special characters except spaces and hyphens
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .substring(0, maxLength) // Limit length
        .replace(/_+$/, ''); // Remove trailing underscores
}

// Function to get project questions from API
async function getProjectQuestions(api, projectId) {
    try {
        const response = await api.get(`/analyzer/results/${projectId}/questions`);
        const questions = response.data || [];
        
        const questionsMap = {};
        questions.forEach((question, index) => {
            questionsMap[question.id || question._id] = {
                text: question.question || question.text,
                index: index + 1,
                probing_goal: question.probing_goal || '',
                follow_up_question: question.follow_up_question || ''
            };
        });
        
        return questionsMap;
    } catch (error) {
        console.log(`No questions found for project ${projectId}: ${error.message}`);
        return {};
    }
}

// Function to get conversations from API
async function getConversations(api, projectId, status = 'digested') {
    try {
        const response = await api.get(`/analyzer/results/${projectId}/conversations`);
        let conversations = response.data || [];
        
        // Filter by status if provided
        if (status) {
            conversations = conversations.filter(conv => conv.status === status);
        }
        
        return conversations;
    } catch (error) {
        console.error(`Failed to get conversations for project ${projectId}:`, error.message);
        return [];
    }
}

// Function to get conversation details with messages
async function getConversationDetails(api, projectId, conversationId) {
    try {
        const response = await api.get(`/analyzer/results/${projectId}/conversations/${conversationId}`);
        return response.data;
    } catch (error) {
        console.error(`Failed to get conversation details for ${conversationId}:`, error.message);
        return null;
    }
}

// Function to get all projects in a workspace
async function getProjectsFromWorkspace(api, workspaceId) {
    // Dashboard endpoints are not available
    console.error(`❌ Cannot list projects for workspace ${workspaceId}`);
    console.error('   Dashboard API endpoints are not accessible with current authentication.');
    console.error('   Please specify individual project IDs using -p option instead.');
    return [];
}

// Function to group messages by question
function groupMessagesByQuestion(conversations, questionsMap) {
    const questionGroups = {};
    const unrelatedMessages = [];
    
    // Initialize groups for each question
    Object.keys(questionsMap).forEach(questionId => {
        questionGroups[questionId] = [];
    });
    
    conversations.forEach(conversation => {
        if (!conversation.messages || conversation.messages.length === 0) {
            return;
        }
        
        // Group messages by relates_to field
        const messageGroups = {};
        
        conversation.messages.forEach(message => {
            const relatesTo = message.relates_to;
            
            if (!relatesTo) {
                unrelatedMessages.push({ conversation, message });
                return;
            }
            
            if (!messageGroups[relatesTo]) {
                messageGroups[relatesTo] = [];
            }
            messageGroups[relatesTo].push(message);
        });
        
        // Add grouped messages to question groups
        Object.keys(messageGroups).forEach(questionId => {
            if (questionGroups[questionId]) {
                questionGroups[questionId].push({
                    conversation,
                    messages: messageGroups[questionId]
                });
            }
        });
    });
    
    return { questionGroups, unrelatedMessages };
}

// Function to write conversation transcript for specific messages
function writeConversationTranscript(outputFile, conversation, messages, conversationCount) {
    const metadata = extractMetadata(conversation);
    const respondentIndex = conversation.respondent_index || "Unknown";
    
    // Write the transcript header with metadata
    outputFile.write("\n\n" + "=".repeat(80) + "\n");
    outputFile.write(`TRANSCRIPT #${conversationCount}\n`);
    outputFile.write("=".repeat(80) + "\n");
    outputFile.write(`Conversation ID: ${conversation._id || conversation.id}\n`);
    outputFile.write(`Respondent ID: ${metadata.participantId}\n`);
    outputFile.write(`Respondent Index: ${respondentIndex}\n`);
    outputFile.write(`Date: ${metadata.created}\n`);
    outputFile.write(`Duration: ${metadata.duration}\n`);
    
    // Add conversation summary if available
    if (conversation.summary) {
        outputFile.write(`\nSUMMARY:\n`);
        outputFile.write(`    ${conversation.summary}\n`);
    }
    
    // Add all metadata key-value pairs if available
    if (conversation.metadata) {
        outputFile.write(`METADATA:\n`);
        Object.keys(conversation.metadata).forEach(key => {
            const value = conversation.metadata[key];
            let formattedValue;
            if (typeof value === 'object' && value !== null) {
                formattedValue = JSON.stringify(value, null, 2)
                    .replace(/^/gm, '    ');
            } else {
                formattedValue = value;
            }
            outputFile.write(`  ${key}: ${formattedValue}\n`);
        });
    }
    outputFile.write("=".repeat(80) + "\n\n");

    // Write conversation transcript for the specific messages
    if (messages && messages.length > 0) {
        let currentSpeaker = null;
        let paragraphCount = 1;
        
        outputFile.write(`CONVERSATION TRANSCRIPT:\n`);
        
        for (const message of messages) {
            // Skip system messages
            if (message.role === 'system') {
                continue;
            }

            // Get timestamp if available
            const timestamp = message.created_at ? 
                formatDate(message.created_at) : 
                `[${messages.indexOf(message) + 1}]`;
            
            // Format the speaker name
            const speaker = message.role === "user" ? "RESPONDENT" : "INTERVIEWER";
            
            // If speaker changes, output the speaker name
            if (currentSpeaker !== speaker) {
                outputFile.write("\n" + speaker + " (" + timestamp + "):\n");
                currentSpeaker = speaker;
                paragraphCount = 1;
            }
            
            // Get the message text
            let messageText = "";
            if (message.data && message.data.length > 0 && message.data[0].transcription_text) {
                messageText = message.data[0].transcription_text;
            } else if (message.text) {
                messageText = message.text;
            } else {
                messageText = "[No text content available]";
            }
            
            // Format the message text with proper indentation for qualitative analysis
            const formattedText = messageText
                .split('\n')
                .map(line => `    ${line}`)
                .join('\n');
            
            outputFile.write(`    [P${paragraphCount}] ${formattedText}\n`);
            paragraphCount++;
        }
    } else {
        outputFile.write("No messages for this question in this conversation.\n");
    }
}

// Helper function to write file and return a promise
function writeFileAsync(outputPath, writeFunction) {
    return new Promise((resolve, reject) => {
        const outputFile = fs.createWriteStream(outputPath);
        
        outputFile.on('error', reject);
        outputFile.on('finish', () => {
            resolve();
        });
        
        // Call the write function with the output file
        writeFunction(outputFile);
        
        // End the stream
        outputFile.end();
    });
}

// Function to export data split by question for a single project
async function exportByQuestion(api, projectId, conversations, questionsMap, outputDir, createExportDirFn) {
    const { questionGroups, unrelatedMessages } = groupMessagesByQuestion(conversations, questionsMap);
    
    // Create export directory with proper hierarchy
    const projectOutputDir = createExportDirFn ? 
        await createExportDirFn(projectId, outputDir) : 
        path.join(outputDir, projectId);
    
    if (!createExportDirFn && !fs.existsSync(projectOutputDir)) {
        fs.mkdirSync(projectOutputDir, { recursive: true });
    }
    
    const writePromises = [];
    
    // Create a file for each question
    for (const [questionId, conversationData] of Object.entries(questionGroups)) {
        if (conversationData.length === 0) {
            console.log(`No data for question ${questionId} in project ${projectId}, skipping...`);
            continue;
        }
        
        const question = questionsMap[questionId];
        const sanitizedQuestion = sanitizeFilename(question.text);
        const filename = `${projectId}_Q${question.index}_${sanitizedQuestion}.txt`;
        const outputPath = path.join(projectOutputDir, filename);
        
        console.log(`Creating file for Project ${projectId}, Question ${question.index}: ${outputPath}`);
        
        const writePromise = writeFileAsync(outputPath, (outputFile) => {
            // Write header
            outputFile.write("QUALITATIVE RESEARCH TRANSCRIPT - QUESTION SPECIFIC\n");
            outputFile.write(`Project ID: ${projectId}\n`);
            outputFile.write(`Export Date: ${new Date().toISOString().replace('T', ' ').substring(0, 19)}\n`);
            outputFile.write("=".repeat(80) + "\n");
            
            // Write question details
            outputFile.write(`QUESTION ${question.index}:\n`);
            outputFile.write(`${question.text}\n`);
            if (question.probing_goal) {
                outputFile.write(`\nProbing Goal: ${question.probing_goal}\n`);
            }
            outputFile.write("=".repeat(80) + "\n");
            
            // Write conversations for this question
            let conversationCount = 0;
            conversationData.forEach(({ conversation, messages }) => {
                conversationCount++;
                writeConversationTranscript(outputFile, conversation, messages, conversationCount);
            });
            
            // Write summary
            outputFile.write("\n\nTRANSCRIPT SUMMARY\n");
            outputFile.write("=".repeat(80) + "\n");
            outputFile.write(`Question: ${question.text}\n`);
            outputFile.write(`Total Conversations: ${conversationCount}\n`);
            outputFile.write(`Project ID: ${projectId}\n`);
            outputFile.write(`Export Generated: ${new Date().toISOString().replace('T', ' ').substring(0, 19)}\n`);
            outputFile.write("=".repeat(80) + "\n");
        });
        
        writePromises.push(writePromise);
    }
    
    // Create file for unrelated messages if enabled and there are any
    if (unrelatedMessages.length > 0) {
        const filename = `${projectId}_unrelated_messages.txt`;
        const outputPath = path.join(projectOutputDir, filename);
        
        console.log(`Creating file for unrelated messages in project ${projectId}: ${outputPath}`);
        
        const writePromise = writeFileAsync(outputPath, (outputFile) => {
            outputFile.write("QUALITATIVE RESEARCH TRANSCRIPT - UNRELATED MESSAGES\n");
            outputFile.write(`Project ID: ${projectId}\n`);
            outputFile.write(`Export Date: ${new Date().toISOString().replace('T', ' ').substring(0, 19)}\n`);
            outputFile.write("=".repeat(80) + "\n");
            outputFile.write("Messages without relates_to field or with unrecognized question IDs\n");
            outputFile.write("=".repeat(80) + "\n");
            
            unrelatedMessages.forEach(({ conversation, message }, index) => {
                outputFile.write(`\nMessage ${index + 1}:\n`);
                outputFile.write(`Conversation ID: ${conversation._id || conversation.id}\n`);
                outputFile.write(`Message Role: ${message.role}\n`);
                outputFile.write(`Timestamp: ${formatDate(message.created_at)}\n`);
                outputFile.write(`Relates To: ${message.relates_to || 'null'}\n`);
                
                let messageText = "";
                if (message.data && message.data.length > 0 && message.data[0].transcription_text) {
                    messageText = message.data[0].transcription_text;
                } else if (message.text) {
                    messageText = message.text;
                } else {
                    messageText = "[No text content available]";
                }
                
                outputFile.write(`Text: ${messageText}\n`);
                outputFile.write("-".repeat(40) + "\n");
            });
        });
        
        writePromises.push(writePromise);
    }
    
    // Wait for all files to be written
    await Promise.all(writePromises);
}

// Single file export function
async function exportSingleFile(conversationsList, projectId, outputDir, createExportDirFn) {
    // Create export directory with proper hierarchy
    const projectOutputDir = createExportDirFn ? 
        await createExportDirFn(projectId, outputDir) : 
        path.join(outputDir, projectId);
    
    if (!createExportDirFn && !fs.existsSync(projectOutputDir)) {
        fs.mkdirSync(projectOutputDir, { recursive: true });
    }
    
    const outputFileName = `${projectId}_transcripts.txt`;
    const outputPath = path.join(projectOutputDir, outputFileName);
    
    await writeFileAsync(outputPath, (outputFile) => {
        // Write header to file
        outputFile.write("QUALITATIVE RESEARCH TRANSCRIPT\n");
        outputFile.write(`Project ID: ${projectId}\n`);
        outputFile.write(`Export Date: ${new Date().toISOString().replace('T', ' ').substring(0, 19)}\n`);
        outputFile.write("=".repeat(80) + "\n");
        
        // Process conversations
        let conversationCount = 0;
        
        for (const conversation of conversationsList) {
            conversationCount++;
            console.log(`Processing conversation ${conversationCount} of ${conversationsList.length} for project ${projectId}`);
            
            // Use the existing logic for processing full conversations
            const metadata = extractMetadata(conversation);
            const respondentIndex = conversation.respondent_index || "Unknown";
            
            // Write the transcript header with metadata
            outputFile.write("\n\n" + "=".repeat(80) + "\n");
            outputFile.write(`TRANSCRIPT #${conversationCount}\n`);
            outputFile.write("=".repeat(80) + "\n");
            outputFile.write(`Conversation ID: ${conversation._id || conversation.id}\n`);
            outputFile.write(`Respondent ID: ${metadata.participantId}\n`);
            outputFile.write(`Respondent Index: ${respondentIndex}\n`);
            outputFile.write(`Date: ${metadata.created}\n`);
            outputFile.write(`Duration: ${metadata.duration}\n`);
            
            // Add conversation summary if available
            if (conversation.summary) {
                outputFile.write(`\nSUMMARY:\n`);
                outputFile.write(`    ${conversation.summary}\n`);
            }
            
            // Add all metadata key-value pairs if available
            if (conversation.metadata) {
                outputFile.write(`METADATA:\n`);
                Object.keys(conversation.metadata).forEach(key => {
                    const value = conversation.metadata[key];
                    let formattedValue;
                    if (typeof value === 'object' && value !== null) {
                        formattedValue = JSON.stringify(value, null, 2)
                            .replace(/^/gm, '    ');
                    } else {
                        formattedValue = value;
                    }
                    outputFile.write(`  ${key}: ${formattedValue}\n`);
                });
            }
            outputFile.write("=".repeat(80) + "\n\n");
        
            // Check if messages exist and iterate through them
            if (conversation.messages && conversation.messages.length > 0) {
                let currentSpeaker = null;
                let paragraphCount = 1;
                let questionId = 0;
                
                outputFile.write(`CONVERSATION TRANSCRIPT:\n`);
                
                for (const message of conversation.messages) {
                    // Skip system messages
                    if (message.role === 'system') {
                        continue;
                    }
                    // If questionId changes, output it
                    if (questionId !== message.relates_to) {
                        questionId = message.relates_to;
                        outputFile.write("\n Question Id: (" + questionId + "):\n");
                    }

                    // Get timestamp if available
                    const timestamp = message.created_at ? 
                        formatDate(message.created_at) : 
                        `[${conversation.messages.indexOf(message) + 1}]`;
                    
                    // Format the speaker name
                    const speaker = message.role === "user" ? "RESPONDENT" : "INTERVIEWER";
                    
                    // If speaker changes, output the speaker name
                    if (currentSpeaker !== speaker) {
                        outputFile.write("\n" + speaker + " (" + timestamp + "):\n");
                        currentSpeaker = speaker;
                        paragraphCount = 1;
                    }
                    
                    // Get the message text
                    let messageText = "";
                    if (message.data && message.data.length > 0 && message.data[0].transcription_text) {
                        messageText = message.data[0].transcription_text;
                    } else if (message.text) {
                        messageText = message.text;
                    } else {
                        messageText = "[No text content available]";
                    }
                    
                    // Format the message text with proper indentation for qualitative analysis
                    const formattedText = messageText
                        .split('\n')
                        .map(line => `    ${line}`)
                        .join('\n');
                    
                    outputFile.write(`    [P${paragraphCount}] ${formattedText}\n`);
                    paragraphCount++;
                }
            } else {
                outputFile.write("No messages in this conversation.\n");
            }
        }
        
        // Write summary
        outputFile.write("\n\nTRANSCRIPT SUMMARY\n");
        outputFile.write("=".repeat(80) + "\n");
        outputFile.write(`Total Conversations: ${conversationCount}\n`);
        outputFile.write(`Project ID: ${projectId}\n`);
        outputFile.write(`Export Generated: ${new Date().toISOString().replace('T', ' ').substring(0, 19)}\n`);
        outputFile.write("=".repeat(80) + "\n");
    });
    
    console.log(`Export complete for project ${projectId}! File saved to: ${outputPath}`);
}

// Process a single project
async function processProject(api, projectId, options, createExportDirFn) {
    try {
        // Verify project exists by trying to get its info
        console.log(`📂 Processing project: ${projectId}`);
        
        // Get conversations for the project
        console.log(`📊 Fetching conversations for project ${projectId}...`);
        const conversations = await getConversations(api, projectId, 'digested');
        console.log(`📊 Found ${conversations.length} conversations with status 'digested' for project ${projectId}`);
        
        if (conversations.length === 0) {
            console.log(`ℹ️  No conversations found for project ${projectId}, skipping...`);
            return;
        }
        
        // Get detailed conversation data with messages
        console.log(`📥 Fetching detailed conversation data...`);
        const detailedConversations = [];
        
        for (let i = 0; i < conversations.length; i++) {
            const conv = conversations[i];
            console.log(`   Fetching conversation ${i + 1} of ${conversations.length}...`);
            
            const detailed = await getConversationDetails(api, projectId, conv._id || conv.id);
            if (detailed) {
                detailedConversations.push(detailed);
            }
            
            // Add small delay to avoid rate limiting
            if (options.delay > 0) {
                await new Promise(resolve => setTimeout(resolve, options.delay));
            }
        }
        
        if (options.splitByQuestion) {
            // Get project questions
            console.log(`🔍 Fetching project questions for ${projectId}...`);
            const questionsMap = await getProjectQuestions(api, projectId);
            
            if (Object.keys(questionsMap).length === 0) {
                console.log(`ℹ️  No questions found for project ${projectId}, falling back to single file export`);
                await exportSingleFile(detailedConversations, projectId, options.outputDir, createExportDirFn);
            } else {
                console.log(`✅ Found ${Object.keys(questionsMap).length} questions for project ${projectId}`);
                await exportByQuestion(api, projectId, detailedConversations, questionsMap, options.outputDir, createExportDirFn);
                console.log(`✅ Export by question complete for project ${projectId}!`);
            }
        } else {
            // Single file export for this project
            await exportSingleFile(detailedConversations, projectId, options.outputDir, createExportDirFn);
        }
        
        console.log(`✅ Successfully completed export for project ${projectId}`);
        
    } catch (error) {
        console.error(`❌ Error processing project ${projectId}:`, error.message);
        if (!options.continueOnError) {
            throw error;
        }
        console.log(`⏭️  Continuing with next project...`);
    }
}

// Main export function
async function exportTranscripts(api, options, createExportDirFn) {
    try {
        // Create the output directory if it doesn't exist
        if (!fs.existsSync(options.outputDir)) {
            fs.mkdirSync(options.outputDir, { recursive: true });
        }
        
        // Show configuration summary
        console.log(`\n${'='.repeat(60)}`);
        console.log('EXPORT CONFIGURATION SUMMARY');
        console.log(`${'='.repeat(60)}`);
        console.log(`Projects: ${options.projects ? options.projects.length : 0}`);
        console.log(`Workspaces: ${options.workspaces ? options.workspaces.length : 0}`);
        console.log(`Split by Question: ${options.splitByQuestion}`);
        console.log(`Include Unrelated Messages: ${options.includeUnrelatedMessages}`);
        console.log(`Output Directory: ${options.outputDir}`);
        
        // Collect all project IDs
        let allProjectIds = [];
        
        // Add directly specified project IDs
        if (options.projects && options.projects.length > 0) {
            allProjectIds = allProjectIds.concat(options.projects);
        }
        
        // Add project IDs from workspaces
        if (options.workspaces && options.workspaces.length > 0) {
            console.log(`\n${'='.repeat(60)}`);
            console.log('Finding projects from workspace IDs...');
            console.log(`${'='.repeat(60)}`);
            
            for (const workspaceId of options.workspaces) {
                console.log(`\nFinding projects in workspace: ${workspaceId}`);
                const workspaceProjects = await getProjectsFromWorkspace(api, workspaceId);
                console.log(`Found ${workspaceProjects.length} projects in workspace ${workspaceId}`);
                
                workspaceProjects.forEach(project => {
                    allProjectIds.push(project.id);
                    console.log(`  - Added project: ${project.id} (${project.title})`);
                });
            }
        }
        
        // Remove duplicates
        allProjectIds = [...new Set(allProjectIds)];
        
        if (allProjectIds.length === 0) {
            console.log('No projects found to process. Please check your project IDs and workspace IDs.');
            return;
        }
        
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Starting export for ${allProjectIds.length} total projects`);
        console.log(`${'='.repeat(60)}`);
        
        // Process each project
        for (let i = 0; i < allProjectIds.length; i++) {
            const projectId = allProjectIds[i];
            console.log(`\n${'-'.repeat(60)}`);
            console.log(`Processing project ${i + 1} of ${allProjectIds.length}: ${projectId}`);
            console.log(`${'-'.repeat(60)}`);
            
            await processProject(api, projectId, options, createExportDirFn);
        }
        
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Completed processing all ${allProjectIds.length} projects!`);
        console.log(`${'='.repeat(60)}`);
        
    } catch (error) {
        console.error('Error during export:', error);
        throw error;
    }
}

module.exports = {
    exportTranscripts
};