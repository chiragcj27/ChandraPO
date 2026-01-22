import mongoose from "mongoose";

export interface TrackingStatus {
  status: string;
  timestamp: Date;
  location?: string;
  description?: string;
}

export interface Tracking {
  trackingId: string;
  provider: string;
  latestStatus: string;
  statusHistory: TrackingStatus[];
  isActive: boolean; // Stop tracking when delivered
  lastUpdated: Date;
}

const trackingStatusSchema = new mongoose.Schema<TrackingStatus>({
  status: { type: String, required: true },
  timestamp: { type: Date, required: true, default: Date.now },
  location: { type: String },
  description: { type: String },
}, { _id: false });

const trackingSchema = new mongoose.Schema<Tracking>({
  trackingId: { type: String, required: true, unique: true, index: true },
  provider: { type: String, required: true },
  latestStatus: { type: String, required: true },
  statusHistory: { type: [trackingStatusSchema], default: [] },
  isActive: { type: Boolean, default: true, index: true },
  lastUpdated: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

// Avoid OverwriteModelError during hot reloads
if (mongoose.models.Tracking) {
  delete mongoose.models.Tracking;
}

const TrackingModel = mongoose.model<Tracking>("Tracking", trackingSchema);

export default TrackingModel;

