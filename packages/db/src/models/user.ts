import mongoose from "mongoose";

export type UserRole = "admin" | "client";

export interface User {
  email: string;
  password: string; // Hashed password
  role: UserRole;
  clientId?: mongoose.Types.ObjectId | null; // Reference to Client for client users
  name?: string; // Optional display name
  isActive?: boolean; // For soft deletion/activation
}

const userSchema = new mongoose.Schema<User>(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["admin", "client"], required: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", default: null },
    name: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  },
);

// Avoid OverwriteModelError during hot reloads
if (mongoose.models.User) {
  delete mongoose.models.User;
}

const UserModel =
  mongoose.model<User>("User", userSchema) as mongoose.Model<User>;

export default UserModel;


