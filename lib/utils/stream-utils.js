/**
 * @fileoverview Streaming utilities for handling large datasets.
 * Provides memory-efficient stream processing for CSV, JSON, and API data
 * with support for batching, rate limiting, and progress tracking.
 * 
 * @module lib/utils/stream-utils
 */

const { Transform, Writable } = require('stream');
const { pipeline } = require('stream/promises');
const { logger } = require('../logger');

/**
 * Create a transform stream for processing items in batches.
 * Accumulates items until batch size is reached, then processes them together.
 * 
 * @param {number} batchSize - Number of items per batch
 * @param {Function} processor - Async function to process batch
 * @param {Array} processor.batch - Array of items to process
 * @returns {Transform} Transform stream in object mode
 * @example
 * const batchStream = createBatchStream(100, async (batch) => {
 *   // Process 100 items at once
 *   return await api.post('/bulk', batch);
 * });
 */
function createBatchStream(batchSize, processor) {
  let batch = [];
  
  return new Transform({
    objectMode: true,
    
    async transform(chunk, encoding, callback) {
      batch.push(chunk);
      
      if (batch.length >= batchSize) {
        try {
          const results = await processor(batch);
          batch = [];
          
          // Push results individually
          for (const result of results) {
            this.push(result);
          }
          callback();
        } catch (error) {
          callback(error);
        }
      } else {
        callback();
      }
    },
    
    async flush(callback) {
      if (batch.length > 0) {
        try {
          const results = await processor(batch);
          for (const result of results) {
            this.push(result);
          }
          callback();
        } catch (error) {
          callback(error);
        }
      } else {
        callback();
      }
    }
  });
}

/**
 * Create a progress tracking stream.
 * Counts items passing through and reports progress.
 * 
 * @param {number|null} total - Total items expected (null if unknown)
 * @param {Function} onProgress - Progress callback function
 * @param {number} onProgress.current - Current item count
 * @param {number|null} onProgress.total - Total expected items
 * @returns {Transform} Transform stream in object mode
 * @example
 * const progressStream = createProgressStream(1000, (current, total) => {
 *   console.log(`Progress: ${current}/${total}`);
 * });
 */
function createProgressStream(total, onProgress) {
  let count = 0;
  
  return new Transform({
    objectMode: true,
    
    transform(chunk, encoding, callback) {
      count++;
      if (onProgress) {
        onProgress(count, total);
      }
      this.push(chunk);
      callback();
    }
  });
}

/**
 * Create a CSV parsing stream.
 * Parses CSV input into JavaScript objects.
 * 
 * @param {Object} [options={}] - CSV parser options
 * @param {boolean} [options.columns=true] - Use first line as column names
 * @param {boolean} [options.skip_empty_lines=true] - Skip empty lines
 * @param {string} [options.delimiter=','] - Column delimiter
 * @returns {Transform} CSV parser stream
 * @example
 * const parser = createCSVParser({ delimiter: ';' });
 * fileStream.pipe(parser).on('data', (row) => {
 *   console.log(row); // { name: 'John', age: '30' }
 * });
 */
function createCSVParser(options = {}) {
  const { parse } = require('csv-parse');
  return parse({
    columns: true,
    skip_empty_lines: true,
    ...options
  });
}

/**
 * Create a CSV stringifier stream.
 * Converts JavaScript objects to CSV format.
 * 
 * @param {Object} [options={}] - CSV stringifier options
 * @param {boolean} [options.header=true] - Include header row
 * @param {string[]} [options.columns] - Column names/order
 * @param {string} [options.delimiter=','] - Column delimiter
 * @returns {Transform} CSV stringifier stream
 * @example
 * const stringifier = createCSVStringifier({
 *   columns: ['name', 'age', 'email']
 * });
 */
function createCSVStringifier(options = {}) {
  const { stringify } = require('csv-stringify');
  return stringify({
    header: true,
    ...options
  });
}

/**
 * Create a JSON array stream parser.
 * Parses a JSON array incrementally, emitting each item.
 * 
 * @returns {Transform} JSON parser stream
 * @example
 * const parser = createJSONArrayParser();
 * fileStream.pipe(parser).on('data', (item) => {
 *   console.log('Got item:', item);
 * });
 */
function createJSONArrayParser() {
  const JSONStream = require('JSONStream');
  return JSONStream.parse('*');
}

/**
 * Create a rate-limited stream.
 * Ensures items pass through at a maximum rate.
 * 
 * @param {number} itemsPerSecond - Maximum items per second
 * @returns {Transform} Rate limited stream in object mode
 * @example
 * // Process max 10 items per second
 * const rateLimiter = createRateLimitStream(10);
 * sourceStream.pipe(rateLimiter).pipe(apiStream);
 */
function createRateLimitStream(itemsPerSecond) {
  const delay = 1000 / itemsPerSecond;
  let lastTime = 0;
  
  return new Transform({
    objectMode: true,
    
    async transform(chunk, encoding, callback) {
      const now = Date.now();
      const timeSinceLastItem = now - lastTime;
      
      if (timeSinceLastItem < delay) {
        await new Promise(resolve => setTimeout(resolve, delay - timeSinceLastItem));
      }
      
      lastTime = Date.now();
      this.push(chunk);
      callback();
    }
  });
}

/**
 * Stream processor for API pagination.
 * Automatically handles pagination to stream all results.
 * 
 * @param {AxiosInstance} api - Authenticated API client
 * @param {string} endpoint - API endpoint to paginate
 * @param {Object} [options={}] - Pagination options
 * @param {number} [options.pageSize=100] - Items per page
 * @param {Object} [options.params={}] - Additional query parameters
 * @yields {Object} Individual items from paginated results
 * @throws {Error} If API request fails
 * @example
 * for await (const conversation of streamPaginatedAPI(api, '/conversations')) {
 *   console.log(conversation.id);
 * }
 */
async function* streamPaginatedAPI(api, endpoint, options = {}) {
  const { pageSize = 100, params = {} } = options;
  let offset = 0;
  let hasMore = true;
  
  while (hasMore) {
    try {
      const items = await api.get(endpoint, {
        params: {
          limit: pageSize,
          offset,
          ...params
        }
      });
      
      const itemsArray = Array.isArray(items) ? items : [];
      
      if (itemsArray.length === 0) {
        hasMore = false;
      } else {
        yield* itemsArray;
        offset += itemsArray.length;
        
        // Stop if we got less than a full page
        if (itemsArray.length < pageSize) {
          hasMore = false;
        }
      }
    } catch (error) {
      logger.error(`Error fetching page at offset ${offset}:`, error.message);
      throw error;
    }
  }
}

/**
 * Process stream pipeline with error handling.
 * Connects input through transforms to output.
 * 
 * @param {ReadableStream} input - Input stream
 * @param {Transform[]} transforms - Array of transform streams
 * @param {WritableStream} output - Output stream
 * @returns {Promise<void>}
 * @throws {Error} If stream processing fails
 * @example
 * await processStream(
 *   fs.createReadStream('input.csv'),
 *   [csvParser, transformer, filter],
 *   fs.createWriteStream('output.csv')
 * );
 */
async function processStream(input, transforms, output) {
  try {
    await pipeline(input, ...transforms, output);
  } catch (error) {
    logger.error('Stream processing error:', error.message);
    throw error;
  }
}

/**
 * Create a memory-efficient JSON writer for large arrays.
 * Writes JSON array incrementally without loading all data in memory.
 * 
 * @param {string} filePath - Output file path
 * @returns {Object} Writer object
 * @returns {Function} returns.write - Write an item to the array
 * @returns {Function} returns.close - Close the array and file
 * @example
 * const writer = createJSONArrayWriter('output.json');
 * for (const item of largeDataset) {
 *   writer.write(item);
 * }
 * await writer.close();
 */
function createJSONArrayWriter(filePath) {
  const fs = require('fs');
  const stream = fs.createWriteStream(filePath);
  let isFirst = true;
  
  stream.write('[');
  
  return {
    write(item) {
      if (!isFirst) {
        stream.write(',');
      }
      stream.write('\n  ' + JSON.stringify(item));
      isFirst = false;
    },
    
    async close() {
      stream.write('\n]');
      return new Promise((resolve, reject) => {
        stream.end((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  };
}

/**
 * Create a chunked file reader.
 * Reads large files in manageable chunks to avoid memory issues.
 * 
 * @param {string} filePath - File path to read
 * @param {number} [chunkSize=1048576] - Bytes per chunk (default 1MB)
 * @yields {Buffer} File chunks
 * @throws {Error} If file cannot be read
 * @example
 * for await (const chunk of readFileInChunks('large.bin', 1024 * 1024 * 10)) {
 *   // Process 10MB chunks
 *   await processChunk(chunk);
 * }
 */
async function* readFileInChunks(filePath, chunkSize = 1024 * 1024) {
  const fs = require('fs').promises;
  const handle = await fs.open(filePath, 'r');
  
  try {
    const buffer = Buffer.alloc(chunkSize);
    let position = 0;
    
    while (true) {
      const { bytesRead } = await handle.read(buffer, 0, chunkSize, position);
      
      if (bytesRead === 0) {
        break;
      }
      
      yield buffer.slice(0, bytesRead);
      position += bytesRead;
    }
  } finally {
    await handle.close();
  }
}

/**
 * Create a stream processor for large CSV files.
 * Handles CSV transformation with batching and progress tracking.
 * 
 * @param {Object} [options={}] - Processing options
 * @param {number} [options.batchSize=1000] - Rows per batch
 * @param {Function} [options.onBatch] - Callback after each batch
 * @param {Function} [options.onProgress] - Progress callback
 * @returns {Object} CSV processor with process method
 * @returns {Function} returns.process - Process CSV file
 * @example
 * const processor = createLargeCSVProcessor({
 *   batchSize: 500,
 *   onProgress: (count) => console.log(`Processed ${count} rows`)
 * });
 * 
 * await processor.process('input.csv', 'output.csv', async (batch) => {
 *   // Transform batch of rows
 *   return batch.map(row => ({ ...row, processed: true }));
 * });
 */
function createLargeCSVProcessor(options = {}) {
  const { batchSize = 1000, onBatch, onProgress } = options;
  
  return {
    async process(inputPath, outputPath, transformer) {
      const fs = require('fs');
      const { pipeline } = require('stream/promises');
      
      const readStream = fs.createReadStream(inputPath);
      const writeStream = fs.createWriteStream(outputPath);
      
      const transforms = [
        createCSVParser(),
        createBatchStream(batchSize, async (batch) => {
          const transformed = await transformer(batch);
          if (onBatch) {
            await onBatch(transformed);
          }
          return transformed;
        })
      ];
      
      if (onProgress) {
        transforms.push(createProgressStream(null, onProgress));
      }
      
      transforms.push(createCSVStringifier());
      
      await pipeline(readStream, ...transforms, writeStream);
    }
  };
}

module.exports = {
  createBatchStream,
  createProgressStream,
  createCSVParser,
  createCSVStringifier,
  createJSONArrayParser,
  createRateLimitStream,
  streamPaginatedAPI,
  processStream,
  createJSONArrayWriter,
  readFileInChunks,
  createLargeCSVProcessor
};