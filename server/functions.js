const { PDFLoader } = require("langchain/document_loaders/fs/pdf");
const { CharacterTextSplitter } = require("langchain/text_splitter");
const { Configuration, OpenAIApi } = require("openai");
const fs = require('fs');
const util = require('util');
const writeFileAsync = util.promisify(fs.writeFile);
require('dotenv').config();
const PDFExtract = require('pdf.js-extract').PDFExtract;



const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

async function gptApiCall(doc, topic) {
    try {
        const completion = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: [{
                "role": "system", "content": `You are Anki-gpt. Your job is to turn the content you are provided into Anki flashcards.\nDesired format: {question};{answer} next line {question};{answer}. Eg: When did the French Revolution take place?;The French Revolution took place from 1789 to 1799.`
            },
            {
                role: "user", content: `You are prompted with a part of a document about: ${topic}. \nChunk of document in between #: \n########\n${doc}\n########`
            }],
        });
        const message = completion.data.choices[0].message;
        if (message === null || message === undefined) {
          throw new Error("An error occurred during the API call. Empty response received.");
        }
        return message;
    } catch (error) {
        // Log the error for debugging
        console.error("Error in gptApiCall:", error);
        throw error;
    }
}
  
async function generateTextChunksFromPDF(filePath) {
    const pdfExtract = new PDFExtract();
    const options = {}; // Add your extraction options here
  
    try {
      const data = await new Promise((resolve, reject) => {
        pdfExtract.extract(filePath, options, (err, extractedData) => {
          if (err) {
            reject(err);
          } else {
            resolve(extractedData);
          }
        });
      });
  
      const lines = PDFExtract.utils.pageToLines(data.pages[0], 2);
      const rows = PDFExtract.utils.extractTextRows(lines);
  
      const textPDF = rows.map((row) => row.join("")).join("\n");
    
      const textChunks = [];
      const chunkSize = 600; // Adjust this value to set the desired chunk size
      const chunkOverlap = 100; // Adjust this value to set the desired overlap
  
      let startIndex = 0;
      let endIndex = Math.min(chunkSize, textPDF.length);
  
      while (startIndex < textPDF.length) {
        const chunk = textPDF.substring(startIndex, endIndex);
        textChunks.push(chunk);
  
        if (endIndex < textPDF.length) {
          startIndex = endIndex - chunkOverlap; // Move the start index by overlap
        } else {
          break;
        }
        endIndex = Math.min(startIndex + chunkSize, textPDF.length);
      }
  
      return textChunks;
    } catch (error) {
      console.error('An error occurred:', error);
      throw error; // Rethrow the error if needed
    }
  }
 
const functions = {
    gptApiCall,
    generateTextChunksFromPDF
};
module.exports=functions;