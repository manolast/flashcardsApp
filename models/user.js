const mongoose = require('mongoose');
const { Schema } = mongoose;

const flashcardSchema = new Schema({
  question: {
    type: String,
    required: true,
  },
  answer: {
    type: String,
    required: true,
  },
});

const userSchema = new Schema({
  email: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    required: true,
  },
  flashcards: [
    {
      type: Schema.Types.ObjectId,
      ref: 'Flashcard',
    },
  ],
  subscriptionId: {
    type: String,
    required:true,
  },
});

const Flashcard = mongoose.model('Flashcard', flashcardSchema);
const User = mongoose.model('User', userSchema);

module.exports = {
  Flashcard,
  User,
};