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

module.exports = {
  setupRecordingsDirectory,
  cleanupOldRecordings
};