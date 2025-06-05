const fs = require('fs');
const path = require('path');
const csv = require('csv-parse');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

/**
 * Bulk invite users to an organization from a CSV file
 * @param {object} api - Axios instance with auth
 * @param {object} options - Command options
 */
async function bulkInviteUsers(api, options) {
  const { organizationId, csvFile, role, outputDir, dryRun, delay } = options;
  
  console.log('👥 Starting bulk user invitation...');
  
  // Validate role
  const validRoles = ['admin', 'moderator', 'viewer'];
  if (!validRoles.includes(role)) {
    throw new Error(`Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`);
  }
  
  // Read and parse CSV file
  console.log(`📄 Reading CSV file: ${csvFile}`);
  
  if (!fs.existsSync(csvFile)) {
    throw new Error(`CSV file not found: ${csvFile}`);
  }
  
  const csvContent = fs.readFileSync(csvFile, 'utf-8');
  const records = await new Promise((resolve, reject) => {
    csv.parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }, (err, records) => {
      if (err) reject(err);
      else resolve(records);
    });
  });
  
  if (records.length === 0) {
    throw new Error('No records found in CSV file');
  }
  
  console.log(`   Found ${records.length} users to invite`);
  
  // Validate CSV structure
  const requiredFields = ['email', 'name'];
  const firstRecord = records[0];
  const missingFields = requiredFields.filter(field => !firstRecord.hasOwnProperty(field));
  
  if (missingFields.length > 0) {
    throw new Error(`CSV missing required fields: ${missingFields.join(', ')}`);
  }
  
  // Prepare output
  const results = [];
  const timestamp = new Date().toISOString().split('T')[0];
  
  // Process each user
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;
  
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const email = record.email?.toLowerCase().trim();
    const name = record.name?.trim();
    
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      console.log(`   ⚠️  Row ${i + 2}: Invalid email: ${email || '(empty)'}`);
      results.push({
        email: email || '(empty)',
        name: name || '',
        status: 'error',
        message: 'Invalid email format'
      });
      errorCount++;
      continue;
    }
    
    // Validate name
    if (!name) {
      console.log(`   ⚠️  Row ${i + 2}: Missing name for ${email}`);
      results.push({
        email,
        name: '',
        status: 'error',
        message: 'Name is required'
      });
      errorCount++;
      continue;
    }
    
    try {
      if (dryRun) {
        console.log(`   🔍 [DRY RUN] Would invite: ${name} (${email}) as ${role}`);
        results.push({
          email,
          name,
          status: 'dry-run',
          message: `Would be invited as ${role}`,
          role
        });
        successCount++;
      } else {
        // Make API call to invite user
        console.log(`   📧 Inviting: ${name} (${email}) as ${role}`);
        
        const invitePayload = {
          email,
          name,
          role
        };
        
        try {
          const response = await api.post(
            `/organizations/${organizationId}/invite`,
            invitePayload
          );
          
          console.log(`   ✅ Successfully invited: ${email}`);
          results.push({
            email,
            name,
            status: 'success',
            message: 'Invitation sent',
            role,
            invitationId: response.data.invitationId || response.data.id
          });
          successCount++;
        } catch (error) {
          const errorMessage = error.response?.data?.message || error.message;
          
          // Handle specific error cases
          if (errorMessage.includes('already exists') || errorMessage.includes('already a member')) {
            console.log(`   ⏭️  User already exists: ${email}`);
            results.push({
              email,
              name,
              status: 'skipped',
              message: 'User already exists in organization',
              role
            });
            skippedCount++;
          } else {
            console.error(`   ❌ Failed to invite ${email}: ${errorMessage}`);
            results.push({
              email,
              name,
              status: 'error',
              message: errorMessage,
              role
            });
            errorCount++;
          }
        }
      }
      
      // Add delay between requests
      if (delay > 0 && i < records.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      console.error(`   ❌ Unexpected error for ${email}: ${error.message}`);
      results.push({
        email,
        name,
        status: 'error',
        message: error.message
      });
      errorCount++;
    }
  }
  
  // Write results to CSV
  const outputPath = path.join(outputDir, `bulk_invite_results_${organizationId}_${timestamp}.csv`);
  const csvWriter = createCsvWriter({
    path: outputPath,
    header: [
      { id: 'email', title: 'Email' },
      { id: 'name', title: 'Name' },
      { id: 'status', title: 'Status' },
      { id: 'message', title: 'Message' },
      { id: 'role', title: 'Role' },
      { id: 'invitationId', title: 'Invitation ID' }
    ]
  });
  
  await csvWriter.writeRecords(results);
  console.log(`\n📄 Results saved to: ${outputPath}`);
  
  // Summary
  console.log('\n📊 Bulk Invite Summary:');
  console.log(`   Total users: ${records.length}`);
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ⏭️  Skipped: ${skippedCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  
  if (dryRun) {
    console.log('\n🔍 [DRY RUN MODE - No invitations were sent]');
  }
  
  return {
    total: records.length,
    success: successCount,
    skipped: skippedCount,
    errors: errorCount,
    resultsFile: outputPath
  };
}

module.exports = { bulkInviteUsers };