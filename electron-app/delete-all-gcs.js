require('dotenv').config();
const { Storage } = require('@google-cloud/storage');

async function deleteAllFromGCS() {
  const storage = new Storage({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
  });
  const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

  console.log('🗑️  Deleting everything from GCS...\n');

  // Delete all collections
  console.log('Deleting collections...');
  const [collectionFiles] = await bucket.getFiles({ prefix: 'collections/' });
  for (const file of collectionFiles) {
    await file.delete();
  }
  console.log(`✅ Deleted ${collectionFiles.length} collection files`);

  // Delete all images
  console.log('\nDeleting images...');
  const [imageFiles] = await bucket.getFiles({ prefix: 'images/' });
  let count = 0;
  for (const file of imageFiles) {
    await file.delete();
    count++;
    if (count % 10 === 0) {
      console.log(`   Deleted ${count}/${imageFiles.length}...`);
    }
  }
  console.log(`✅ Deleted ${imageFiles.length} image files`);

  // Delete all metadata
  console.log('\nDeleting metadata...');
  const [metadataFiles] = await bucket.getFiles({ prefix: 'metadata/' });
  for (const file of metadataFiles) {
    await file.delete();
  }
  console.log(`✅ Deleted ${metadataFiles.length} metadata files`);

  // Delete all embeddings
  console.log('\nDeleting embeddings...');
  const [embeddingFiles] = await bucket.getFiles({ prefix: 'embeddings/' });
  for (const file of embeddingFiles) {
    await file.delete();
  }
  console.log(`✅ Deleted ${embeddingFiles.length} embedding files`);

  console.log('\n═══════════════════════════════════════');
  console.log('✅ GCS COMPLETELY CLEANED!');
  console.log('═══════════════════════════════════════');
}

deleteAllFromGCS().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
