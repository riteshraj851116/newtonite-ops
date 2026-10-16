const mongoose = require('mongoose');

const idempotencyRecordSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    endpoint: {
      type: String,
      required: true,
    },
    requestHash: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['IN_PROGRESS', 'COMPLETED', 'FAILED'],
      default: 'IN_PROGRESS',
    },
    statusCode: {
      type: Number,
      default: null,
    },
    responseBody: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 86400, // MongoDB TTL: automatically remove records older than 24 hours
    },
  },
  {
    timestamps: false,
  }
);

module.exports = mongoose.model('IdempotencyRecord', idempotencyRecordSchema);
