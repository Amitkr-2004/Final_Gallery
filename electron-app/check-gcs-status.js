require('dotenv').config();
const { Storage } = require('@google-cloud/storage');

async function checkGCS() {
  const storage = new Storage({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
  });
  const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

  console.log('Checking GCS contents...\n');

  // Count collections
  const [collectionFiles] = await bucket.getFiles({ prefix: 'collections/' });
  console.log(`Collections in GCS: ${collectionFiles.length}`);

  // Count images
  const [imageFiles] = await bucket.getFiles({ prefix: 'images/' });
  console.log(`Images in GCS: ${imageFiles.length}`);

  console.log('\n---');
  console.log('Local DB has:');
  console.log('  - 122 images');
  console.log('  - 185 collections');
}

checkGCS().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
