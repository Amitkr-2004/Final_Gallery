const { Storage } = require('@google-cloud/storage');
const { getGCPConfig, getCredentialsForSDK } = require('./config/gcp-config');
require('dotenv').config();

async function checkImages() {
  const gcpConfig = getGCPConfig();
  const storage = new Storage(getCredentialsForSDK(gcpConfig));
  const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

  const [files] = await bucket.getFiles({ prefix: 'images/' });

  console.log('=== IMAGES IN GCS ===');
  const imageFiles = files.filter(f =>
    (f.name.endsWith('.jpg') || f.name.endsWith('.jpeg'))
  );

  console.log(`Total image files: ${imageFiles.length}\n`);
  imageFiles.forEach((f, i) => {
    const parts = f.name.split('/');
    const filename = parts[parts.length - 1];
    console.log(`${i+1}. ${filename}`);
  });
}

checkImages().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
