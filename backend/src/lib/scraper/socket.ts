// Minimal Socket.io event emitter for scraper progress

export function emitScrapeProgress(jobId: string, data: any) {
  // This is a placeholder. Integrate with your actual Socket.io instance.
  // Example: io.to(jobId).emit('scrape:progress', data);
  console.log(`[Socket] Progress for job ${jobId}:`, data);
}
