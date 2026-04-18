require('dotenv').config();
const axios = require('axios');

async function listModels() {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) {
    console.error('No GEMINI_API_KEY found in .env');
    return;
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
    const response = await axios.get(url);
    
    console.log('Available Models:');
    response.data.models.forEach(m => {
      console.log(`- ${m.name.replace('models/', '')} (Supported Methods: ${m.supportedGenerationMethods.join(', ')})`);
    });
  } catch (err) {
    console.error('Failed to list models:');
    if (err.response) {
      console.error(err.response.status, err.response.data);
    } else {
      console.error(err.message);
    }
  }
}

listModels();
