const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { promisify } = require('util');
const stream = require('stream');
const pipeline = promisify(stream.pipeline);

// Helper function to sanitize filename
function sanitizeFilename(text, maxLength = 50) {
    return text
        .replace(/[^\w\s-]/g, '') // Remove special characters except spaces and hyphens
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .substring(0, maxLength) // Limit length
        .replace(/_+$/, ''); // Remove trailing underscores
}

// Helper function to get file extension from MIME type or URL
function getFileExtension(type, url) {
    // Try to get extension from MIME type
    const mimeExtensions = {
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'image/svg+xml': '.svg',
        'video/mp4': '.mp4',
        'video/mpeg': '.mpeg',
        'video/quicktime': '.mov',
        'video/webm': '.webm',
        'audio/mpeg': '.mp3',
        'audio/mp3': '.mp3',
        'audio/wav': '.wav',
        'audio/wave': '.wav',
        'audio/webm': '.webm',
        'audio/ogg': '.ogg',
        'audio/aac': '.aac',
        'audio/m4a': '.m4a',
        'application/pdf': '.pdf'
    };
    
    if (type && mimeExtensions[type.toLowerCase()]) {
        return mimeExtensions[type.toLowerCase()];
    }
    
    // Try to extract extension from URL
    if (url) {
        const urlPath = url.split('?')[0]; // Remove query parameters
        const match = urlPath.match(/\.[a-zA-Z0-9]+$/);
        if (match) {
            return match[0];
        }
    }
    
    // Default based on type prefix
    if (type) {
        if (type.startsWith('image/')) return '.jpg';
        if (type.startsWith('video/')) return '.mp4';
        if (type.startsWith('audio/')) return '.mp3';
    }
    
    return '.bin'; // Binary file default
}

// Function to download a single file
async function downloadFile(url, outputPath) {
    try {
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            timeout: 60000, // 60 second timeout
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
        
        // Ensure directory exists
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        // Create write stream
        const writer = fs.createWriteStream(outputPath);
        
        // Pipe the response to file
        await pipeline(response.data, writer);
        
        return true;
    } catch (error) {
        console.error(`   ❌ Failed to download ${url}: ${error.message}`);
        return false;
    }
}

// Function to get conversations from API
async function getConversations(api, projectId, status = null) {
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

// Function to extract media from a conversation
function extractMediaFromConversation(conversation) {
    const mediaItems = [];
    
    if (!conversation.messages || conversation.messages.length === 0) {
        return mediaItems;
    }
    
    conversation.messages.forEach((message, messageIndex) => {
        // Skip if no data array
        if (!message.data || !Array.isArray(message.data)) {
            return;
        }
        
        // Look for attachments in the data array
        message.data.forEach((dataItem, dataIndex) => {
            // Check if it's a media attachment (has file_id and type)
            if (dataItem.file_id && dataItem.type) {
                // Get media URL from the message or data item
                let mediaUrl = null;
                
                // Check for URL in different possible locations
                if (dataItem.url) {
                    mediaUrl = dataItem.url;
                } else if (dataItem.file_url) {
                    mediaUrl = dataItem.file_url;
                } else if (dataItem.media_url) {
                    mediaUrl = dataItem.media_url;
                } else if (dataItem.signed_url) {
                    mediaUrl = dataItem.signed_url;
                }
                
                if (mediaUrl) {
                    mediaItems.push({
                        conversationId: conversation._id || conversation.id,
                        messageId: message._id || message.id || `msg_${messageIndex}`,
                        messageIndex,
                        dataIndex,
                        role: message.role,
                        timestamp: message.created_at,
                        fileId: dataItem.file_id,
                        type: dataItem.type,
                        mimeType: dataItem.mime_type || dataItem.content_type,
                        url: mediaUrl,
                        transcription: dataItem.transcription_text || null,
                        originalFilename: dataItem.filename || dataItem.name || null
                    });
                }
            }
        });
    });
    
    return mediaItems;
}

// Function to download media for a single conversation
async function downloadConversationMedia(conversation, outputDir, options) {
    const conversationId = conversation._id || conversation.id;
    const mediaItems = extractMediaFromConversation(conversation);
    
    if (mediaItems.length === 0) {
        return { conversationId, totalMedia: 0, downloaded: 0, failed: 0 };
    }
    
    console.log(`   📁 Found ${mediaItems.length} media files in conversation ${conversationId}`);
    
    // Create conversation-specific directory
    const conversationDir = path.join(outputDir, conversationId);
    if (!fs.existsSync(conversationDir)) {
        fs.mkdirSync(conversationDir, { recursive: true });
    }
    
    // Create metadata file for the conversation
    const metadata = {
        conversationId,
        respondentId: conversation.user_id || "Unknown",
        respondentIndex: conversation.respondent_index || "Unknown",
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
        summary: conversation.summary || null,
        customMetadata: conversation.metadata || {},
        mediaFiles: []
    };
    
    let downloaded = 0;
    let failed = 0;
    
    // Download each media file
    for (const [index, media] of mediaItems.entries()) {
        const extension = getFileExtension(media.mimeType || media.type, media.url);
        const role = media.role === 'user' ? 'respondent' : 'interviewer';
        const timestamp = media.timestamp ? new Date(media.timestamp).toISOString().replace(/[:.]/g, '-') : 'unknown';
        
        // Create filename: {index}_{role}_{timestamp}_{type}{extension}
        let filename = `${String(index + 1).padStart(3, '0')}_${role}_${timestamp}_${media.type}${extension}`;
        
        // If original filename exists, append it (sanitized)
        if (media.originalFilename) {
            const sanitized = sanitizeFilename(path.basename(media.originalFilename, extension));
            filename = `${String(index + 1).padStart(3, '0')}_${role}_${timestamp}_${sanitized}${extension}`;
        }
        
        const outputPath = path.join(conversationDir, filename);
        
        console.log(`   ⬇️  Downloading ${filename}...`);
        
        const success = await downloadFile(media.url, outputPath);
        
        if (success) {
            downloaded++;
            
            // Add to metadata
            metadata.mediaFiles.push({
                filename,
                originalFileId: media.fileId,
                type: media.type,
                mimeType: media.mimeType,
                role: media.role,
                messageIndex: media.messageIndex,
                timestamp: media.timestamp,
                transcription: media.transcription,
                originalFilename: media.originalFilename
            });
        } else {
            failed++;
        }
        
        // Add delay if specified
        if (options.delay > 0 && index < mediaItems.length - 1) {
            await new Promise(resolve => setTimeout(resolve, options.delay));
        }
    }
    
    // Save metadata file
    const metadataPath = path.join(conversationDir, 'metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    
    // Save transcriptions if any audio files have them
    const transcriptions = metadata.mediaFiles
        .filter(m => m.transcription)
        .map(m => ({
            file: m.filename,
            timestamp: m.timestamp,
            role: m.role,
            transcription: m.transcription
        }));
    
    if (transcriptions.length > 0) {
        const transcriptPath = path.join(conversationDir, 'transcriptions.json');
        fs.writeFileSync(transcriptPath, JSON.stringify(transcriptions, null, 2));
    }
    
    return {
        conversationId,
        totalMedia: mediaItems.length,
        downloaded,
        failed
    };
}

// Function to process a single project
async function processProject(api, projectId, options) {
    try {
        console.log(`📂 Processing project: ${projectId}`);
        
        // Get conversations for the project
        console.log(`📊 Fetching conversations for project ${projectId}...`);
        const conversations = await getConversations(api, projectId, options.status);
        console.log(`📊 Found ${conversations.length} conversations${options.status ? ` with status '${options.status}'` : ''}`);
        
        if (conversations.length === 0) {
            console.log(`ℹ️  No conversations found for project ${projectId}`);
            return {
                projectId,
                totalConversations: 0,
                conversationsWithMedia: 0,
                totalMedia: 0,
                downloaded: 0,
                failed: 0
            };
        }
        
        // If specific conversation ID is provided, filter
        let conversationsToProcess = conversations;
        if (options.conversationId) {
            conversationsToProcess = conversations.filter(c => 
                (c._id || c.id) === options.conversationId
            );
            
            if (conversationsToProcess.length === 0) {
                console.log(`❌ Conversation ${options.conversationId} not found in project ${projectId}`);
                return null;
            }
        }
        
        // Create project output directory
        const projectOutputDir = path.join(options.outputDir, projectId);
        if (!fs.existsSync(projectOutputDir)) {
            fs.mkdirSync(projectOutputDir, { recursive: true });
        }
        
        // Process each conversation
        const results = {
            projectId,
            totalConversations: conversationsToProcess.length,
            conversationsWithMedia: 0,
            totalMedia: 0,
            downloaded: 0,
            failed: 0
        };
        
        console.log(`📥 Fetching detailed conversation data...`);
        
        for (let i = 0; i < conversationsToProcess.length; i++) {
            const conv = conversationsToProcess[i];
            const conversationId = conv._id || conv.id;
            
            console.log(`\n🔍 Processing conversation ${i + 1} of ${conversationsToProcess.length}: ${conversationId}`);
            
            // Get detailed conversation data
            const detailed = await getConversationDetails(api, projectId, conversationId);
            if (!detailed) {
                console.log(`   ⚠️  Failed to get details for conversation ${conversationId}`);
                continue;
            }
            
            // Download media for this conversation
            const convResult = await downloadConversationMedia(detailed, projectOutputDir, options);
            
            if (convResult.totalMedia > 0) {
                results.conversationsWithMedia++;
                results.totalMedia += convResult.totalMedia;
                results.downloaded += convResult.downloaded;
                results.failed += convResult.failed;
                
                console.log(`   ✅ Downloaded ${convResult.downloaded}/${convResult.totalMedia} media files`);
            } else {
                console.log(`   ℹ️  No media files found in this conversation`);
            }
            
            // Add delay between conversations
            if (options.delay > 0 && i < conversationsToProcess.length - 1) {
                await new Promise(resolve => setTimeout(resolve, options.delay));
            }
        }
        
        // Create project summary
        const summaryPath = path.join(projectOutputDir, 'download_summary.json');
        const summary = {
            projectId,
            downloadDate: new Date().toISOString(),
            filter: {
                status: options.status || 'all',
                conversationId: options.conversationId || null
            },
            results
        };
        fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
        
        return results;
        
    } catch (error) {
        console.error(`❌ Error processing project ${projectId}:`, error.message);
        if (!options.continueOnError) {
            throw error;
        }
        return null;
    }
}

// Main download function
async function downloadMedia(api, options) {
    try {
        // Create the output directory if it doesn't exist
        if (!fs.existsSync(options.outputDir)) {
            fs.mkdirSync(options.outputDir, { recursive: true });
        }
        
        // Show configuration summary
        console.log(`\n${'='.repeat(60)}`);
        console.log('MEDIA DOWNLOAD CONFIGURATION');
        console.log(`${'='.repeat(60)}`);
        console.log(`Project ID: ${options.projectId}`);
        console.log(`Conversation ID: ${options.conversationId || 'All conversations'}`);
        console.log(`Status Filter: ${options.status || 'All statuses'}`);
        console.log(`Output Directory: ${options.outputDir}`);
        console.log(`Delay Between Downloads: ${options.delay}ms`);
        console.log(`${'='.repeat(60)}\n`);
        
        // Process the project
        const results = await processProject(api, options.projectId, options);
        
        if (!results) {
            console.log('\n❌ Media download failed');
            return;
        }
        
        // Show summary
        console.log(`\n${'='.repeat(60)}`);
        console.log('DOWNLOAD SUMMARY');
        console.log(`${'='.repeat(60)}`);
        console.log(`Total Conversations Processed: ${results.totalConversations}`);
        console.log(`Conversations with Media: ${results.conversationsWithMedia}`);
        console.log(`Total Media Files: ${results.totalMedia}`);
        console.log(`Successfully Downloaded: ${results.downloaded}`);
        console.log(`Failed Downloads: ${results.failed}`);
        console.log(`Output Directory: ${path.join(options.outputDir, options.projectId)}`);
        console.log(`${'='.repeat(60)}`);
        
    } catch (error) {
        console.error('Error during media download:', error);
        throw error;
    }
}

module.exports = {
    downloadMedia
};