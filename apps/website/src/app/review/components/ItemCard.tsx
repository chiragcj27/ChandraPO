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
    <div className={`bg-white rounded-xl shadow-sm p-6 space-y-5 ${isNewItem ? "border-2 border-green-400 bg-green-50/30" : "border border-slate-200"}`}>
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-200">
        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          {isNewItem ? (
            <>
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              <span className="text-green-600">New Item</span>
              <span className="text-sm font-normal text-slate-500">(Position {index + 1} of {totalItems})</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span>Item {index + 1}</span>
              <span className="text-sm font-normal text-slate-500">of {totalItems}</span>
            </>
          )}
        </h3>
        <div className="flex items-center gap-3">
          {!isNewItem && (
            <label className="flex items-center gap-3 cursor-pointer">
              <span className="text-sm font-medium text-slate-700">Mark as Complete</span>
              <button
                onClick={() => onToggleIncomplete(index)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 shadow-inner ${
                  item.IsIncomplete ? "bg-slate-300" : "bg-green-500"
                }`}
                role="switch"
                aria-checked={!item.IsIncomplete}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                    item.IsIncomplete ? "translate-x-1" : "translate-x-6"
                  }`}
                />
              </button>
            </label>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Vendor Style Code
          </label>
          <input
            type="text"
            value={item.VendorStyleCode || ""}
            onChange={(e) =>
              onUpdateItem(index, { ...item, VendorStyleCode: e.target.value })
            }
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-900"
            placeholder="Enter vendor style code"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Item Ref No
          </label>
          <input
            type="text"
            value={item.ItemRefNo || ""}
            onChange={(e) =>
              onUpdateItem(index, { ...item, ItemRefNo: e.target.value })
            }
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-900"
            placeholder="Enter item ref number"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Item PO No
          </label>
          <input
            type="text"
            value={item.ItemPoNo || ""}
            onChange={(e) =>
              onUpdateItem(index, { ...item, ItemPoNo: e.target.value })
            }
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-900"
            placeholder="Enter item PO number"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Order Quantity
          </label>
          <input
            type="number"
            value={item.OrderQty || 0}
            onChange={(e) =>
              onUpdateItem(index, { ...item, OrderQty: parseInt(e.target.value) || 0 })
            }
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-900"
            placeholder="0"
            min="0"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Metal
          </label>
          <select
            value={item.Metal || ""}
            onChange={(e) =>
              onUpdateItem(index, { ...item, Metal: e.target.value })
            }
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-slate-900"
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
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Tone
          </label>
          <select
            value={item.Tone || ""}
            onChange={(e) =>
              onUpdateItem(index, { ...item, Tone: e.target.value })
            }
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-slate-900"
          >
            <option value="">Select tone</option>
            <option value="Y">Y</option>
            <option value="R">R</option>
            <option value="W">W</option>
            <option value="YW">YW</option>
            <option value="RW">RW</option>
            <option value="RY">RY</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Category
          </label>
          <input
            type="text"
            value={item.Category || ""}
            onChange={(e) =>
              onUpdateItem(index, { ...item, Category: e.target.value })
            }
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-900"
            placeholder="Enter category"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Item Size
          </label>
          <input
            type="text"
            value={item.ItemSize || ""}
            onChange={(e) =>
              onUpdateItem(index, { ...item, ItemSize: e.target.value || null })
            }
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-900"
            placeholder="Enter item size"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Stock Type
          </label>
          <select
            value={item.StockType || ""}
            onChange={(e) =>
              onUpdateItem(index, { ...item, StockType: e.target.value || null })
            }
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-slate-900"
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
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Make Type
          </label>
          <select
            value={item.MakeType || ""}
            onChange={(e) =>
              onUpdateItem(index, { ...item, MakeType: e.target.value || null })
            }
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-slate-900"
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
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Customer Production Instruction
          </label>
          <textarea
            value={item.CustomerProductionInstruction || ""}
            onChange={(e) =>
              onUpdateItem(index, { ...item, CustomerProductionInstruction: e.target.value || null })
            }
            rows={3}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-900 resize-y"
            placeholder="Enter customer production instructions"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Special Remarks
          </label>
          <textarea
            value={item.SpecialRemarks || ""}
            onChange={(e) =>
              onUpdateItem(index, { ...item, SpecialRemarks: e.target.value || null })
            }
            rows={3}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-900 resize-y"
            placeholder="Enter special remarks"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Design Production Instruction
          </label>
          <textarea
            value={item.DesignProductionInstruction || ""}
            onChange={(e) =>
              onUpdateItem(index, { ...item, DesignProductionInstruction: e.target.value || null })
            }
            rows={3}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-900 resize-y"
            placeholder="Enter design production instructions"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Stamp Instruction
          </label>
          <textarea
            value={item.StampInstruction || ""}
            onChange={(e) =>
              onUpdateItem(index, { ...item, StampInstruction: e.target.value || null })
            }
            rows={3}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-900 resize-y"
            placeholder="Enter stamp instructions"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
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
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-900"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
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
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-900"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Invoice Number
          </label>
          <input
            type="text"
            value={item.InvoiceNumber || ""}
            onChange={(e) =>
              onUpdateItem(index, { ...item, InvoiceNumber: e.target.value })
            }
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-900"
            placeholder="Enter invoice number"
          />
        </div>
      </div>

      {item.IsIncomplete && !isNewItem && (
        <div className="mt-5 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <svg className="w-5 h-5 text-red-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm text-red-800 font-medium">
            This item is marked as incomplete. Please fill in all required fields.
          </p>
        </div>
      )}

      {isNewItem && (
        <div className="mt-6 pt-5 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={onCancelNewItem}
            className="px-5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50 transition-colors shadow-sm"
          >
            Cancel
          </button>
          <button
            onClick={onSaveNewItem}
            className="px-6 py-2.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-colors shadow-md flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Save Item
          </button>
        </div>
      )}
    </div>
  );
}
