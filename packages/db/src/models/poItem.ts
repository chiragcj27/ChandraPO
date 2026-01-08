import mongoose from "mongoose";

export interface POItemInterface {
    isIncomplete: boolean;
    vendorStyleCode: string;
    itemRefNo: string;
    itemPoNo: string;
    orderQty: number;
    metal: string;
    tone: string;
    category: string;
    stockType?: string | null;
    makeType?: string | null;
    customerProductionInstruction?: string | null;
    specialRemarks?: string | null;
    designProductionInstruction?: string | null;
    stampInstruction?: string | null;
    itemSize?: string | null;
    deadlineDate?: Date | null;
    shippingDate?: Date | null;
    invoiceNumber: string;
    exportedToExcel: boolean;
    completedBy?: mongoose.Types.ObjectId | null; // Reference to User who marked as complete
}

export const poItemSchema = new mongoose.Schema<POItemInterface>({
    isIncomplete: { type: Boolean, required: true, default: true },
    vendorStyleCode: { type: String, required: false, default: "" },
    itemRefNo: { type: String, required: false, default: "" },
    itemPoNo: { type: String, required: false, default: "" },
    orderQty: { type: Number, required: false, default: 0 },
    metal: { type: String, required: false, default: "" },
    tone: { type: String, required: false, default: "" },
    category: { type: String, required: false, default: "" },
    stockType: { type: String, default: null },
    makeType: { type: String, default: null },
    customerProductionInstruction: { type: String, default: null },
    specialRemarks: { type: String, default: null },
    designProductionInstruction: { type: String, default: null },
    stampInstruction: { type: String, default: null },
    itemSize: { type: String, default: null },
    deadlineDate: { type: Date, default: null },
    shippingDate: { type: Date, default: null },
    invoiceNumber: { type: String, required: true, default: "" },
    exportedToExcel: { type: Boolean, required: true, default: false },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, {
    timestamps: true,
})

// Delete existing model if it exists to avoid schema conflicts
if (mongoose.models.POItem) {
  delete mongoose.models.POItem;
}

const POItem = mongoose.model<POItemInterface>("POItem", poItemSchema) as mongoose.Model<POItemInterface>;

export default POItem;