require('dotenv').config();
const { Storage } = require('@google-cloud/storage');

async function deleteAllCollections() {
  const storage = new Storage({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
  });
  const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

  console.log('Fetching collections from GCS...');
  const [files] = await bucket.getFiles({ prefix: 'collections/' });

  console.log(`Found ${files.length} collection files`);

  if (files.length === 0) {
    console.log('No collections to delete');
    return;
  }

  console.log('Deleting collections...');
  let deleted = 0;
  for (const file of files) {
    await file.delete();
    deleted++;
    if (deleted % 10 === 0) {
      console.log(`Deleted ${deleted}/${files.length}...`);
    }
  }

  console.log(`✅ Successfully deleted ${deleted} collections from GCS`);
}

deleteAllCollections().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
