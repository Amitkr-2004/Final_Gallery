/**
 * Download face-api.js models from jsdelivr CDN
 * Works with both face-api.js and @vladmandic/face-api
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const MODELS_DIR = path.join(__dirname, '..', 'models', 'face-api');
const BASE_URL = 'https://unpkg.com/face-api.js@0.22.2/weights';

// Models files
const MODELS = [
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model-shard1',
  'ssd_mobilenetv1_model-shard2',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2'
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`📥 ${path.basename(dest)}`);
    const file = fs.createWriteStream(dest);

    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        file.close();
        try { fs.unlinkSync(dest); } catch (e) {}
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(dest); } catch (e) {}
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`✓ ${path.basename(dest)}`);
        resolve();
      });

      file.on('error', (err) => {
        file.close();
        try { fs.unlinkSync(dest); } catch (e) {}
        reject(err);
      });
    }).on('error', (err) => {
      try {
        file.close();
        fs.unlinkSync(dest);
      } catch (e) {}
      reject(err);
    });
  });
}

async function downloadModels() {
  console.log('📦 Downloading face-api.js models from jsdelivr CDN...\n');

  if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR, { recursive: true });
  }

  let downloaded = 0;
  let skipped = 0;

  for (const modelFile of MODELS) {
    const url = `${BASE_URL}/${modelFile}`;
    const dest = path.join(MODELS_DIR, modelFile);

    if (fs.existsSync(dest)) {
      console.log(`⊘ ${modelFile} (exists)`);
      skipped++;
      continue;
    }

    try {
      await downloadFile(url, dest);
      downloaded++;
    } catch (err) {
      console.error(`✗ ${modelFile}: ${err.message}`);
      process.exit(1);
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log('✅ All models downloaded successfully!');
  console.log(`   Downloaded: ${downloaded}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Location: ${MODELS_DIR}`);
  console.log('='.repeat(50));
}

downloadModels();
