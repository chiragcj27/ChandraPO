import mongoose from "mongoose";

export interface Client {
  name: string;
  mapping: string;
  description?: string | null;
}

const clientSchema = new mongoose.Schema<Client>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    mapping: { type: String, required: true },
    description: { type: String, default: null },
  },
  {
    timestamps: true,
  },
);

// Avoid OverwriteModelError during hot reloads
if (mongoose.models.Client) {
  delete mongoose.models.Client;
}

const ClientModel =
  mongoose.model<Client>("Client", clientSchema) as mongoose.Model<Client>;

export default ClientModel;

