const fs = require('fs');
const path = require('path');

// Load .env manually
const envPath = path.join(__dirname, 'electron-app', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim();
    }
  });
}

const { Storage } = require('@google-cloud/storage');

async function checkEmbeddings() {
  const storage = new Storage({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
  });
  const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

  // Get first collection file
  const [files] = await bucket.getFiles({ prefix: 'collections/', maxResults: 1 });

  if (files.length === 0) {
    console.log('No collections found in GCS');
    return;
  }

  const file = files[0];
  const [data] = await file.download();
  const collection = JSON.parse(data.toString());

  console.log('Collection name:', collection.name);
  console.log('Collection ID:', collection.collection_id);
  console.log('Total faces:', collection.total_faces);
  console.log('Has faces array:', !!collection.faces);
  console.log('Faces array length:', collection.faces ? collection.faces.length : 0);

  if (collection.faces && collection.faces.length > 0) {
    const face = collection.faces[0];
    console.log('\nFirst face:');
    console.log('  - Face ID:', face.face_id);
    console.log('  - Has embedding_vector:', !!face.embedding_vector);
    console.log('  - Embedding length:', face.embedding_vector ? face.embedding_vector.length : 0);
    console.log('  - Embedding sample:', face.embedding_vector ? face.embedding_vector.slice(0, 5) : 'N/A');
  } else {
    console.log('❌ No faces in collection!');
  }

  console.log('\nSynced at:', collection.synced_at);
}

checkEmbeddings().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
