const multer = require('multer');
const path = require('path');
const { setupRecordingsDirectory } = require('../utils/fileUtils');

const recordingsDir = setupRecordingsDirectory();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, recordingsDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    cb(null, `recording-${timestamp}.wav`);
  }
});


module.exports = {
    upload: multer({ storage }),
    recordingsDir
  };
  