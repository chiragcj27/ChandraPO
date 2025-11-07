import mongoose from "mongoose";

export interface POItemInterface {
    isIncomplete: boolean;
    clientItemCode: string;
    chandraItemCode: string;
    jobBagNumber: string;
    description: string;
    quantity: number;
    metalType: string;
    metalColor: string;
    category: string;
    remarks: string;
    size?: string;
    stampingInstructions: string;
    stampRequired: boolean;
    deadlineDate?: Date;
    shippingDate?: Date;
    invoiceNumber: string;
}

export const poItemSchema = new mongoose.Schema<POItemInterface>({
    isIncomplete: { type: Boolean, required: true },
    clientItemCode: { type: String, required: true },
    chandraItemCode: { type: String, default: "" },
    jobBagNumber: { type: String, default: "" },
    description: { type: String, default: "" },
    quantity: { type: Number, default: 0 },
    metalType: { type: String, default: "" },
    metalColor: { type: String, default: "" },
    category: { type: String, default: "" },
    remarks: { type: String, default: "" },
    size: { type: String, required: false },
    stampingInstructions: { type: String, default: "" },
    stampRequired: { type: Boolean, default: false },
    deadlineDate: { type: Date, default: null },
    shippingDate: { type: Date, default: null },
    invoiceNumber: { type: String, default: "" },
})

const POItem = mongoose.model<POItemInterface>("POItem", poItemSchema) as mongoose.Model<POItemInterface>;

export default POItem;