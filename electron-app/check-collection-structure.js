require('dotenv').config();
const { Storage } = require('@google-cloud/storage');

async function checkCollectionStructure() {
  const storage = new Storage({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
  });
  const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

  console.log('Checking collection structure in GCS...\n');

  // Get first collection
  const [files] = await bucket.getFiles({ prefix: 'collections/', maxResults: 1 });

  if (files.length === 0) {
    console.log('No collections found!');
    return;
  }

  const file = files[0];
  const [data] = await file.download();
  const collection = JSON.parse(data.toString());

  console.log('Collection:', collection.name);
  console.log('Collection ID:', collection.collection_id);
  console.log('Total faces:', collection.total_faces);
  console.log('Faces array length:', collection.faces ? collection.faces.length : 0);

  if (collection.faces && collection.faces.length > 0) {
    const face = collection.faces[0];
    console.log('\nFirst face structure:');
    console.log('  - face_id:', face.face_id ? 'YES' : 'NO');
    console.log('  - image_id:', face.image_id ? 'YES' : 'NO');
    console.log('  - confidence:', face.confidence ? 'YES' : 'NO');
    console.log('  - embedding_vector:', face.embedding_vector ? 'YES' : 'NO');

    if (face.embedding_vector) {
      console.log('  - embedding_vector length:', face.embedding_vector.length);
      console.log('  - embedding_vector sample:', face.embedding_vector.slice(0, 5));
    } else {
      console.log('\n*** WARNING: NO EMBEDDING VECTOR! ***');
      console.log('This is why matching is not working!');
    }
  } else {
    console.log('\n*** WARNING: No faces in collection! ***');
  }
}

checkCollectionStructure().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
