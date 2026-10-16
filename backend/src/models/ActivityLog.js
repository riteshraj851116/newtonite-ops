const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    workItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkItem',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      enum: [
        'CREATED',
        'UPDATED',
        'STATUS_CHANGED',
        'ASSIGNED',
        'UNASSIGNED',
        'RESOLVED',
        'COMMENT_ADDED',
      ],
      required: true,
    },
    details: {
      previousStatus: { type: String, default: null },
      newStatus: { type: String, default: null },
      previousAssignee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      newAssignee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      changes: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
      },
      comment: {
        type: String,
        trim: true,
        default: null,
      },
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

activityLogSchema.index({ workItem: 1, timestamp: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
