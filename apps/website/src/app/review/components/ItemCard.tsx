"use client";

import { POItem } from "@/types/po";

interface ItemCardProps {
  item: POItem;
  index: number;
  totalItems: number;
  onToggleIncomplete: (index: number) => void;
  onUpdateItem: (index: number, item: POItem) => void;
  isNewItem?: boolean;
  onSaveNewItem?: () => void;
  onCancelNewItem?: () => void;
}

export default function ItemCard({
  item,
  index,
  totalItems,
  onToggleIncomplete,
  onUpdateItem,
  isNewItem = false,
  onSaveNewItem,
  onCancelNewItem,
}: ItemCardProps) {
  return (
    <div className={`bg-white rounded-lg shadow-sm p-6 space-y-4 ${isNewItem ? "border-2 border-green-400" : "border border-gray-200"}`}>
      <div className="flex items-center justify-between mb-4 pb-4 border-b">
        <h3 className="text-lg font-semibold text-gray-900">
          {isNewItem ? (
            <span className="text-green-600">New Item (Position {index + 1} of {totalItems})</span>
          ) : (
            <>Item {index + 1} of {totalItems}</>
          )}
        </h3>
        <div className="flex items-center gap-3">
          {!isNewItem && (
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm font-medium text-gray-700">Mark as Incomplete</span>
              <button
                onClick={() => onToggleIncomplete(index)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  item.IsIncomplete ? "bg-red-500" : "bg-gray-300"
                }`}
                role="switch"
                aria-checked={item.IsIncomplete}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    item.IsIncomplete ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </label>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Vendor Style Code
          </label>
          <input
            type="text"
            value={item.VendorStyleCode || ""}
            onChange={(e) =>
              onUpdateItem(index, { ...item, VendorStyleCode: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Item Ref No
          </label>
          <input
            type="text"
            value={item.ItemRefNo || ""}
            onChange={(e) =>
              onUpdateItem(index, { ...item, ItemRefNo: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Item PO No
          </label>
          <input
            type="text"
            value={item.ItemPoNo || ""}
            onChange={(e) =>
              onUpdateItem(index, { ...item, ItemPoNo: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Order Quantity
          </label>
          <input
            type="number"
            value={item.OrderQty || 0}
            onChange={(e) =>
              onUpdateItem(index, { ...item, OrderQty: parseInt(e.target.value) || 0 })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Metal
          </label>
          <select
            value={item.Metal || ""}
            onChange={(e) =>
              onUpdateItem(index, { ...item, Metal: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select metal</option>
            <option value="G09KT">G09KT</option>
            <option value="G10KT">G10KT</option>
            <option value="G14KT">G14KT</option>
            <option value="G18KT">G18KT</option>
            <option value="950">950</option>
            <option value="SV925">SV925</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tone
          </label>
          <input
            type="text"
            value={item.Tone || ""}
            onChange={(e) =>
              onUpdateItem(index, { ...item, Tone: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <input
            type="text"
            value={item.Category || ""}
            onChange={(e) =>
              onUpdateItem(index, { ...item, Category: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Item Size
          </label>
          <input
            type="text"
            value={item.ItemSize || ""}
            onChange={(e) =>
              onUpdateItem(index, { ...item, ItemSize: e.target.value || null })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Stock Type
          </label>
          <select
            value={item.StockType || ""}
            onChange={(e) =>
              onUpdateItem(index, { ...item, StockType: e.target.value || null })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select stock type</option>
            <option value="Studded Gold Jewellery IC">Studded Gold Jewellery IC</option>
            <option value="Studded Platinum Jewellery IC">Studded Platinum Jewellery IC</option>
            <option value="Plain Gold Jewellery IC">Plain Gold Jewellery IC</option>
            <option value="Plain Platinum Jewellery IC">Plain Platinum Jewellery IC</option>
            <option value="Studded Semi Mount Gold Jewellery IC">Studded Semi Mount Gold Jewellery IC</option>
            <option value="Studded Silver Jewellery IC">Studded Silver Jewellery IC</option>
            <option value="Plain Silver Jewellery IC">Plain Silver Jewellery IC</option>
            <option value="Studded Semi Mount Platinum Jewellery IC">Studded Semi Mount Platinum Jewellery IC</option>
            <option value="Gold Mount Jewellery IC">Gold Mount Jewellery IC</option>
            <option value="Studded Combination Jewellery IC">Studded Combination Jewellery IC</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Make Type
          </label>
          <select
            value={item.MakeType || ""}
            onChange={(e) =>
              onUpdateItem(index, { ...item, MakeType: e.target.value || null })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select make type</option>
            <option value="CNC">CNC</option>
            <option value="HOLLOW TUBING">HOLLOW TUBING</option>
            <option value="1 PC CAST">1 PC CAST</option>
            <option value="2 PC CAST">2 PC CAST</option>
            <option value="MULTI CAST">MULTI CAST</option>
            <option value="HIP HOP">HIP HOP</option>
          </select>
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Customer Production Instruction
          </label>
          <textarea
            value={item.CustomerProductionInstruction || ""}
            onChange={(e) =>
              onUpdateItem(index, { ...item, CustomerProductionInstruction: e.target.value || null })
            }
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Special Remarks
          </label>
          <textarea
            value={item.SpecialRemarks || ""}
            onChange={(e) =>
              onUpdateItem(index, { ...item, SpecialRemarks: e.target.value || null })
            }
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Design Production Instruction
          </label>
          <textarea
            value={item.DesignProductionInstruction || ""}
            onChange={(e) =>
              onUpdateItem(index, { ...item, DesignProductionInstruction: e.target.value || null })
            }
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Stamp Instruction
          </label>
          <textarea
            value={item.StampInstruction || ""}
            onChange={(e) =>
              onUpdateItem(index, { ...item, StampInstruction: e.target.value || null })
            }
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Deadline Date
          </label>
          <input
            type="date"
            value={
              item.DeadlineDate
                ? new Date(item.DeadlineDate).toISOString().split("T")[0]
                : ""
            }
            onChange={(e) =>
              onUpdateItem(index, {
                ...item,
                DeadlineDate: e.target.value ? new Date(e.target.value).toISOString() : undefined,
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Shipping Date
          </label>
          <input
            type="date"
            value={
              item.ShippingDate
                ? new Date(item.ShippingDate).toISOString().split("T")[0]
                : ""
            }
            onChange={(e) =>
              onUpdateItem(index, {
                ...item,
                ShippingDate: e.target.value ? new Date(e.target.value).toISOString() : undefined,
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Invoice Number
          </label>
          <input
            type="text"
            value={item.InvoiceNumber || ""}
            onChange={(e) =>
              onUpdateItem(index, { ...item, InvoiceNumber: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {item.IsIncomplete && !isNewItem && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800 font-medium">
            ⚠️ This item is marked as incomplete
          </p>
        </div>
      )}

      {isNewItem && (
        <div className="mt-6 pt-4 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={onCancelNewItem}
            className="px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSaveNewItem}
            className="px-6 py-2 rounded-md bg-green-600 text-white font-medium hover:bg-green-700 transition-colors"
          >
            Save Item
          </button>
        </div>
      )}
    </div>
  );
}
