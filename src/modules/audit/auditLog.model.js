import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
      description: 'The user who performed the action',
    },
    action: {
      type: String,
      required: true,
      description: 'The action performed (e.g., INVOICE_CREATED, PAYMENT_SUCCEEDED)',
    },
    entityType: {
      type: String,
      required: true,
      enum: ['Invoice', 'User', 'Transaction', 'System'],
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      description: 'Any extra context about the action (e.g., previous state vs new state)',
    },
  },
  { 
    timestamps: { createdAt: true, updatedAt: false } // Audit logs are append-only; they never update
  }
);

auditLogSchema.pre('findOneAndUpdate', function(next) {
  next(new Error('Audit logs are immutable and cannot be updated.'));
});
auditLogSchema.pre('updateOne', function(next) {
  next(new Error('Audit logs are immutable and cannot be updated.'));
});

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
