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
      'Metal -> Use description last 2-3 words; convert to Enum value from [.....]',
      'Tone -> Use description last 2-3 words; convert to Enum value from [.....]',
      'ItemPoNo -> [Header] Purchase Order Number',
      'ItemRefNo -> Vendor Item #',
      'StockType -> (blank if not present)',
      'MakeType -> (blank if not present)',
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
      'Metal -> Metal Type convert to Enum value from [.....]',
      'Tone -> Color convert to Enum value from [.....]',
      'ItemPoNo -> [Header] PO #',
      'ItemRefNo -> Style #',
      'StockType -> (blank if not present)',
      'MakeType -> (blank if not present)',
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
      'Metal -> Description first few words; convert to Enum value from [.....]',
      'Tone -> Description first few words; convert to Enum value from [.....]',
      'ItemPoNo -> [Header] Order #',
      'ItemRefNo -> Item #',
      'StockType -> (blank if not present)',
      'MakeType -> (blank if not present)',
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
      'Metal -> Description first few words; convert to Enum value from [.....]',
      'Tone -> Description first few words; convert to Enum value from [.....]',
      'ItemPoNo -> P.O. number',
      'ItemRefNo -> (blank if not present)',
      'StockType -> (blank if not present)',
      'MakeType -> (blank if not present)',
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
      'Metal -> Metal Type convert to Enum value from [.....]',
      'Tone -> Metal Color convert to Enum value from [.....]',
      'ItemPoNo -> PURCHASE ORDER#',
      'ItemRefNo -> Amipi Style',
      'StockType -> (blank if not present)',
      'MakeType -> (blank if not present)',
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

