const mongoose = require('mongoose');

// Set up the database connection
mongoose.connect('mongodb://localhost/flashcards', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => {
    console.log('Connected to MongoDB');
})  
.catch((error) => {
    console.error('Error connecting to MongoDB:', error);
});

module.exports = mongoose.connection;