import mongoose from "mongoose";

interface File {
    key: string;
    path: string;
    filename: string;   
    createdAt: Date;
    updatedAt: Date;
}

export const fileSchema = new mongoose.Schema<File>({
    key: { type: String, required: true },
    path: { type: String, required: true },
    filename: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
})

const File = mongoose.model<File>("File", fileSchema);

export default File;