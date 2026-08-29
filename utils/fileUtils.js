const fs = require('fs');
const path = require('path');

function setupRecordingsDirectory() {
  const recordingsDir = path.join(__dirname, '..', 'recordings');
  if (!fs.existsSync(recordingsDir)) {
    fs.mkdirSync(recordingsDir);
  }
  return recordingsDir;
}

function cleanupOldRecordings(recordingsDir, maxAge) {
  const now = Date.now();
  fs.readdir(recordingsDir, (err, files) => {
    if (err) {
      console.error('Failed to read recordings directory:', err);
      return;
    }

    files.forEach(file => {
      const filePath = path.join(recordingsDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) {
          console.error('Failed to get file stats:', err);
          return;
        }

        if (now - stats.mtimeMs > maxAge) {
          fs.unlink(filePath, err => {
            if (err) console.error('Failed to delete old recording:', err);
          });
        }
      });
    });
  });
}

async function cleanupOldTempAudioFiles(tempDir, maxAge) {
  await fs.promises.mkdir(tempDir, { recursive: true });
  const entries = await fs.promises.readdir(tempDir, { withFileTypes: true });
  const now = Date.now();
  let deletedCount = 0;

  for (const entry of entries) {
    if (!entry.isFile() || !/^(speech-.*\.mp3|temp-.*\.wav)$/.test(entry.name)) {
      continue;
    }

    const filePath = path.join(tempDir, entry.name);
    const stats = await fs.promises.stat(filePath);
    if (now - stats.mtimeMs > maxAge) {
      await fs.promises.unlink(filePath);
      deletedCount++;
    }
  }

  return deletedCount;
}

module.exports = {
  setupRecordingsDirectory,
  cleanupOldRecordings,
  cleanupOldTempAudioFiles
};
