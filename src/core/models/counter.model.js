import mongoose from 'mongoose';

/**
 * Counter Schema
 * 
 * Used for generating sequential identifiers securely, avoiding race conditions.
 * Used primarily for generating Invoice Numbers (e.g., INV-1001, INV-1002).
 */
const counterSchema = new mongoose.Schema({
  _id: { 
    type: String, 
    required: true,
    description: "The identifier for the sequence (e.g., 'invoiceNumber')" 
  },
  seq: { 
    type: Number, 
    default: 1000, // Start sequences at 1000 for professional appearance
    description: "The current sequence number" 
  }
});

export const Counter = mongoose.model('Counter', counterSchema);
