import mongoose from "mongoose";

export interface POItemInterface {
    isIncomplete: boolean;
    styleCode: string;
    itemRefNo: string;
    itemPoNo: string;
    chandraItemCode: string;
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
}

export const poItemSchema = new mongoose.Schema<POItemInterface>({
    isIncomplete: { type: Boolean, required: true, default: true },
    styleCode: { type: String, required: true, default: "" },
    itemRefNo: { type: String, required: true, default: "" },
    itemPoNo: { type: String, required: true, default: "" },
    chandraItemCode: { type: String, default: "" },
    orderQty: { type: Number, required: true, default: 0 },
    metal: { type: String, required: true, default: "" },
    tone: { type: String, required: true, default: "" },
    category: { type: String, required: true, default: "" },
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
}, {
    timestamps: true,
})

// Delete existing model if it exists to avoid schema conflicts
if (mongoose.models.POItem) {
  delete mongoose.models.POItem;
}

const POItem = mongoose.model<POItemInterface>("POItem", poItemSchema) as mongoose.Model<POItemInterface>;

export default POItem;