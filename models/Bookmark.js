import mongoose, { Schema } from 'mongoose';

const BookmarkSchema = new Schema({
  userId: { type: String, required: true, index: true },
  targetType: { type: String, enum: ['image', 'album'], required: true, index: true },
  targetId: { type: Schema.Types.ObjectId, required: true, index: true },
}, { timestamps: true });

// ensure a user can only bookmark a target once
BookmarkSchema.index({ userId: 1, targetType: 1, targetId: 1 }, { unique: true });

export default mongoose.model('Bookmark', BookmarkSchema);
