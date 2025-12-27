import { Client } from '@repo/db';

type SeedClient = { name: string; mapping: string; description?: string };

const defaultClients: SeedClient[] = [
  {
    name: 'UNEEK',
    mapping: [
      'StyleCode -> Item No.',
      'ItemSize -> Size',
      'OrderQty -> Pieces',
      'OrderItemPcs -> Pieces',
      'Metal -> Use description last 2-3 words; convert to Enum value from ["G09KT", "G10KT", "G14KT", "G18KT", "950", "SV925"]. Map variations (e.g., "9KT" -> "G09KT", "14K" -> "G14KT", "18K" -> "G18KT", "Platinum" or "PT950" -> "950", "Silver" or "925" -> "SV925")',
      'Tone -> Use description last 2-3 words; convert to Enum value from ["Y", "R", "W", "YW", "RW", "RY"]. Map variations (e.g., "Yellow" or "Y" -> "Y", "Rose" or "R" -> "R", "White" or "W" -> "W", "Yellow White" or "YW" -> "YW", "Rose White" or "RW" -> "RW", "Rose Yellow" or "RY" -> "RY")',
      'ItemPoNo -> [Header] Purchase Order Number',
      'ItemRefNo -> Vendor Item #',
      'StockType -> Extract from Description or Category field; look for keywords like "Studded", "Plain", "Gold", "Platinum", "Silver", "Semi Mount", "Mount", "Combination" and match to enum: ["Studded Gold Jewellery IC", "Studded Platinum Jewellery IC", "Plain Gold Jewellery IC", "Plain Platinum Jewellery IC", "Studded Semi Mount Gold Jewellery IC", "Studded Silver Jewellery IC", "Plain Silver Jewellery IC", "Studded Semi Mount Platinum Jewellery IC", "Gold Mount Jewellery IC", "Studded Combination Jewellery IC"]. Use null if not present or no match.',
      'MakeType -> Extract from Description or Category field; look for keywords like "CNC", "HOLLOW", "TUBING", "CAST", "MULTI", "HIP HOP" and match to enum: ["CNC", "HOLLOW TUBING", "1 PC CAST", "2 PC CAST", "MULTI CAST", "HIP HOP"]. Use null if not present or no match.',
      'CustomerProductionInstruction -> Description apart from stone quality',
      'SpecialRemarks -> Description summary',
      'DesignProductionInstructions -> Stone quality from Description',
      'StampInstruction -> Stamp',
    ].join('\n'),
  },
  {
    name: 'Aneri',
    mapping: [
      'StyleCode -> Vendor Style',
      'ItemSize -> Size',
      'OrderQty -> Order Qty',
      'OrderItemPcs -> Order Qty',
      'Metal -> Metal Type convert to Enum value from ["G09KT", "G10KT", "G14KT", "G18KT", "950", "SV925"]. Map variations (e.g., "9KT" -> "G09KT", "14K" -> "G14KT", "18K" -> "G18KT", "Platinum" or "PT950" -> "950", "Silver" or "925" -> "SV925")',
      'Tone -> Color convert to Enum value from ["Y", "R", "W", "YW", "RW", "RY"]. Map variations (e.g., "Yellow" or "Y" -> "Y", "Rose" or "R" -> "R", "White" or "W" -> "W", "Yellow White" or "YW" -> "YW", "Rose White" or "RW" -> "RW", "Rose Yellow" or "RY" -> "RY")',
      'ItemPoNo -> [Header] PO #',
      'ItemRefNo -> Style #',
      'StockType -> Extract from Description or Category field; look for keywords like "Studded", "Plain", "Gold", "Platinum", "Silver", "Semi Mount", "Mount", "Combination" and match to enum: ["Studded Gold Jewellery IC", "Studded Platinum Jewellery IC", "Plain Gold Jewellery IC", "Plain Platinum Jewellery IC", "Studded Semi Mount Gold Jewellery IC", "Studded Silver Jewellery IC", "Plain Silver Jewellery IC", "Studded Semi Mount Platinum Jewellery IC", "Gold Mount Jewellery IC", "Studded Combination Jewellery IC"]. Use null if not present or no match.',
      'MakeType -> Extract from Description or Category field; look for keywords like "CNC", "HOLLOW", "TUBING", "CAST", "MULTI", "HIP HOP" and match to enum: ["CNC", "HOLLOW TUBING", "1 PC CAST", "2 PC CAST", "MULTI CAST", "HIP HOP"]. Use null if not present or no match.',
      'CustomerProductionInstruction -> Description',
      'SpecialRemarks -> Description details in **',
      'DesignProductionInstructions -> In special instruction after stamping details',
      'StampInstruction -> In special instruction after STAMP till comma',
    ].join('\n'),
  },
  {
    name: 'Surreal',
    mapping: [
      'StyleCode -> Vendor Item #',
      'ItemSize -> Size',
      'OrderQty -> Quantity',
      'OrderItemPcs -> Quantity',
      'Metal -> Description first few words; convert to Enum value from ["G09KT", "G10KT", "G14KT", "G18KT", "950", "SV925"]. Map variations (e.g., "9KT" -> "G09KT", "14K" -> "G14KT", "18K" -> "G18KT", "Platinum" or "PT950" -> "950", "Silver" or "925" -> "SV925")',
      'Tone -> Description first few words; convert to Enum value from ["Y", "R", "W", "YW", "RW", "RY"]. Map variations (e.g., "Yellow" or "Y" -> "Y", "Rose" or "R" -> "R", "White" or "W" -> "W", "Yellow White" or "YW" -> "YW", "Rose White" or "RW" -> "RW", "Rose Yellow" or "RY" -> "RY")',
      'ItemPoNo -> [Header] Order #',
      'ItemRefNo -> Item #',
      'StockType -> Extract from Description or Category field; look for keywords like "Studded", "Plain", "Gold", "Platinum", "Silver", "Semi Mount", "Mount", "Combination" and match to enum: ["Studded Gold Jewellery IC", "Studded Platinum Jewellery IC", "Plain Gold Jewellery IC", "Plain Platinum Jewellery IC", "Studded Semi Mount Gold Jewellery IC", "Studded Silver Jewellery IC", "Plain Silver Jewellery IC", "Studded Semi Mount Platinum Jewellery IC", "Gold Mount Jewellery IC", "Studded Combination Jewellery IC"]. Use null if not present or no match.',
      'MakeType -> Extract from Description or Category field; look for keywords like "CNC", "HOLLOW", "TUBING", "CAST", "MULTI", "HIP HOP" and match to enum: ["CNC", "HOLLOW TUBING", "1 PC CAST", "2 PC CAST", "MULTI CAST", "HIP HOP"]. Use null if not present or no match.',
      'CustomerProductionInstruction -> Description',
      'SpecialRemarks -> (blank if not present)',
      'DesignProductionInstructions -> (blank if not present)',
      'StampInstruction -> (blank if not present)',
    ].join('\n'),
  },
  {
    name: 'TFJ',
    mapping: [
      'StyleCode -> Item #',
      'ItemSize -> Description will have size',
      'OrderQty -> Qty',
      'OrderItemPcs -> Qty',
      'Metal -> Description first few words; convert to Enum value from ["G09KT", "G10KT", "G14KT", "G18KT", "950", "SV925"]. Map variations (e.g., "9KT" -> "G09KT", "14K" -> "G14KT", "18K" -> "G18KT", "Platinum" or "PT950" -> "950", "Silver" or "925" -> "SV925")',
      'Tone -> Description first few words; convert to Enum value from ["Y", "R", "W", "YW", "RW", "RY"]. Map variations (e.g., "Yellow" or "Y" -> "Y", "Rose" or "R" -> "R", "White" or "W" -> "W", "Yellow White" or "YW" -> "YW", "Rose White" or "RW" -> "RW", "Rose Yellow" or "RY" -> "RY")',
      'ItemPoNo -> P.O. number',
      'ItemRefNo -> (blank if not present)',
      'StockType -> Extract from Description or Category field; look for keywords like "Studded", "Plain", "Gold", "Platinum", "Silver", "Semi Mount", "Mount", "Combination" and match to enum: ["Studded Gold Jewellery IC", "Studded Platinum Jewellery IC", "Plain Gold Jewellery IC", "Plain Platinum Jewellery IC", "Studded Semi Mount Gold Jewellery IC", "Studded Silver Jewellery IC", "Plain Silver Jewellery IC", "Studded Semi Mount Platinum Jewellery IC", "Gold Mount Jewellery IC", "Studded Combination Jewellery IC"]. Use null if not present or no match.',
      'MakeType -> Extract from Description or Category field; look for keywords like "CNC", "HOLLOW", "TUBING", "CAST", "MULTI", "HIP HOP" and match to enum: ["CNC", "HOLLOW TUBING", "1 PC CAST", "2 PC CAST", "MULTI CAST", "HIP HOP"]. Use null if not present or no match.',
      'CustomerProductionInstruction -> Description',
      'SpecialRemarks -> Description diamond details or anything in **',
      'DesignProductionInstructions -> (blank if not present)',
      'StampInstruction -> In description if stamp or stamping is mentioned',
    ].join('\n'),
  },
  {
    name: 'Amipi',
    mapping: [
      'StyleCode -> Vendor Style',
      'ItemSize -> Size',
      'OrderQty -> Order Qty',
      'OrderItemPcs -> Order Qty',
      'Metal -> Metal Type convert to Enum value from ["G09KT", "G10KT", "G14KT", "G18KT", "950", "SV925"]. Map variations (e.g., "9KT" -> "G09KT", "14K" -> "G14KT", "18K" -> "G18KT", "Platinum" or "PT950" -> "950", "Silver" or "925" -> "SV925")',
      'Tone -> Metal Color convert to Enum value from ["Y", "R", "W", "YW", "RW", "RY"]. Map variations (e.g., "Yellow" or "Y" -> "Y", "Rose" or "R" -> "R", "White" or "W" -> "W", "Yellow White" or "YW" -> "YW", "Rose White" or "RW" -> "RW", "Rose Yellow" or "RY" -> "RY")',
      'ItemPoNo -> PURCHASE ORDER#',
      'ItemRefNo -> Amipi Style',
      'StockType -> Extract from Description or Category field; look for keywords like "Studded", "Plain", "Gold", "Platinum", "Silver", "Semi Mount", "Mount", "Combination" and match to enum: ["Studded Gold Jewellery IC", "Studded Platinum Jewellery IC", "Plain Gold Jewellery IC", "Plain Platinum Jewellery IC", "Studded Semi Mount Gold Jewellery IC", "Studded Silver Jewellery IC", "Plain Silver Jewellery IC", "Studded Semi Mount Platinum Jewellery IC", "Gold Mount Jewellery IC", "Studded Combination Jewellery IC"]. Use null if not present or no match.',
      'MakeType -> Extract from Description or Category field; look for keywords like "CNC", "HOLLOW", "TUBING", "CAST", "MULTI", "HIP HOP" and match to enum: ["CNC", "HOLLOW TUBING", "1 PC CAST", "2 PC CAST", "MULTI CAST", "HIP HOP"]. Use null if not present or no match.',
      'CustomerProductionInstruction -> (blank if not present)',
      'SpecialRemarks -> Description if you find any diamond quality',
      'DesignProductionInstructions -> Description',
      'StampInstruction -> Stamping Instruction',
    ].join('\n'),
  },
];

export const seedDefaultClients = async () => {
  for (const client of defaultClients) {
    try {
      await Client.findOneAndUpdate(
        { name: client.name },
        {
          name: client.name,
          mapping: client.mapping,
          description: client.description ?? null,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    } catch (error) {
      console.error(`Failed to seed client ${client.name}:`, error);
    }
  }
};

export default seedDefaultClients;

