import mongoose from 'mongoose';
import { Counter } from '../../core/models/counter.model.js';

const lineItemSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      required: [true, 'Item description is required'],
      trim: true,
    },
    quantity: {
      type: Number,
      required: [true, 'Item quantity is required'],
      min: [1, 'Quantity must be at least 1'],
    },
    unitPrice: {
      type: Number,
      required: [true, 'Item unit price is required'],
      min: [0, 'Unit price cannot be negative'],
    },
    amount: {
      type: Number, // quantity * unitPrice, computed before saving
      required: true,
    },
  },
  { _id: false } // No separate _id for sub-documents
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      unique: true,
      immutable: true, // Once set, this field can never be changed
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Invoice must be assigned to a client'],
      index: true,
    },
    items: {
      type: [lineItemSchema],
      validate: {
        validator: (items) => items.length > 0,
        message: 'Invoice must have at least one line item',
      },
    },
    subtotal: {
      type: Number,
      required: true,
      min: [0, 'Subtotal cannot be negative'],
    },
    tax: {
      type: Number,
      default: 0,
      min: [0, 'Tax cannot be negative'],
    },
    total: {
      type: Number,
      required: true,
      min: [0.01, 'Total must be greater than zero'],
    },
    currency: {
      type: String,
      default: 'USD',
      enum: ['USD', 'EUR', 'GBP'],
      uppercase: true,
    },
    status: {
      type: String,
      enum: ['draft', 'pending', 'processing', 'paid', 'overdue', 'cancelled'],
      default: 'draft',
      index: true,
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
    },
    notes: {
      type: String,
      trim: true,
      default: null,
    },
    stripeSessionId: {
      type: String,
      sparse: true, // Only indexed when present, saving index space
      unique: true,
      default: undefined,
    },
    stripePaymentIntentId: {
      type: String,
      sparse: true,
      unique: true,
      default: undefined,
    },
    stripeCustomerId: {
      type: String,
      default: null,
    },
    checkoutSessionExpiresAt: {
      type: Date,
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    receiptUrl: {
      type: String,
      default: null,
    },
    receiptStorage: {
      type: String,
      default: null,
    },
    receiptPublicId: {
      type: String,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

invoiceSchema.pre(/^find/, function (next) {
  this.where({ isDeleted: { $ne: true } });
  next();
});

invoiceSchema.pre('validate', async function (next) {
  if (this.isNew && !this.invoiceNumber) {
    try {
      const counter = await Counter.findByIdAndUpdate(
        { _id: 'invoiceNumber' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      this.invoiceNumber = `INV-${counter.seq}`;
      next();
    } catch (err) {
      next(err);
    }
  } else {
    next();
  }
});

export const Invoice = mongoose.model('Invoice', invoiceSchema);
