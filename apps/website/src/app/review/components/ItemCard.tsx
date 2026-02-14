"use client";

import { useState, useRef, useEffect } from "react";
import { POItem } from "@/types/po";

interface ItemCardProps {
  item: POItem;
  index: number;
  totalItems: number;
  onToggleIncomplete: (index: number) => void;
  onUpdateItem: (index: number, item: POItem) => void;
  onDeleteItem?: (index: number) => void;
  isNewItem?: boolean;
  onSaveNewItem?: () => void;
  onCancelNewItem?: () => void;
  readOnly?: boolean;
}

export default function ItemCard({
  item,
  index,
  totalItems,
  onToggleIncomplete,
  onUpdateItem,
  onDeleteItem,
  isNewItem = false,
  onSaveNewItem,
  onCancelNewItem,
  readOnly = false,
}: ItemCardProps) {
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close dialog when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dialogRef.current &&
        !dialogRef.current.contains(event.target as Node) &&
        toggleButtonRef.current &&
        !toggleButtonRef.current.contains(event.target as Node)
      ) {
        setShowCompleteDialog(false);
      }
    };

    if (showCompleteDialog) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showCompleteDialog]);

  const handleToggleClick = () => {
    setShowCompleteDialog(true);
  };

  const handleConfirmComplete = () => {
    onToggleIncomplete(index);
    setShowCompleteDialog(false);
  };

  const handleCancelComplete = () => {
    setShowCompleteDialog(false);
  };
  // Helper function to check if a field is empty/null
  const isFieldEmpty = (value: string | number | null | undefined): boolean => {
    if (value === null || value === undefined) return true;
    if (typeof value === "string" && value.trim() === "") return true;
    if (typeof value === "number" && value === 0) return true;
    return false;
  };

  // Helper function to get input className with validation styling
  const getInputClassName = (value: string | number | null | undefined, baseClassName: string): string => {
    const isEmpty = isFieldEmpty(value);
    if (isEmpty) {
      // Replace border-slate-300 with border-red-500 and update focus colors
      return baseClassName
        .replace(/border-slate-300/g, "border-red-500")
        .replace(/focus:border-blue-500/g, "focus:border-red-500")
        .replace(/focus:ring-blue-500/g, "focus:ring-red-500");
    }
    return baseClassName;
  };

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
        {!readOnly && (
          <div className="flex items-center gap-3">
            {!isNewItem && (
              <>
                <label className="flex items-center gap-3 cursor-pointer relative">
                  <span className="text-sm font-medium text-slate-700">Mark as Complete</span>
                  <button
                    ref={toggleButtonRef}
                    onClick={handleToggleClick}
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
                  {showCompleteDialog && (
                    <div
                      ref={dialogRef}
                      className="absolute top-full right-0 mt-2 z-50 bg-white rounded-lg shadow-xl border border-slate-200 p-4 min-w-[280px]"
                    >
                      <div className="flex items-start gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-sm font-semibold text-slate-900 mb-1">
                            {item.IsIncomplete ? "Mark as Complete?" : "Mark as Incomplete?"}
                          </h3>
                          <p className="text-xs text-slate-600">
                            {item.IsIncomplete
                              ? "Are you sure you want to mark this item as complete?"
                              : "Are you sure you want to mark this item as incomplete?"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={handleCancelComplete}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50 transition-colors text-sm"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleConfirmComplete}
                          className="px-3 py-1.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-colors text-sm"
                        >
                          Confirm
                        </button>
                      </div>
                    </div>
                  )}
                </label>
                {onDeleteItem && (
                  <button
                    onClick={() => onDeleteItem(index)}
                    className="px-3 py-1.5 rounded-lg border border-red-300 bg-red-50 hover:bg-red-100 text-red-700 font-medium transition-colors flex items-center gap-2 text-sm shadow-sm"
                    title="Delete this item"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Vendor Style Code
          </label>
          <input
            type="text"
            value={item.VendorStyleCode || ""}
            disabled={readOnly}
            onChange={(e) =>
              onUpdateItem(index, { ...item, VendorStyleCode: e.target.value })
            }
            className={getInputClassName(item.VendorStyleCode, `w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-900 ${readOnly ? "bg-slate-50 cursor-not-allowed" : ""}`)}
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
            disabled={readOnly}
            onChange={(e) =>
              onUpdateItem(index, { ...item, ItemRefNo: e.target.value })
            }
            className={getInputClassName(item.ItemRefNo, "w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-900")}
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
            disabled={readOnly}
            onChange={(e) =>
              onUpdateItem(index, { ...item, ItemPoNo: e.target.value })
            }
            className={getInputClassName(item.ItemPoNo, "w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-900")}
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
            disabled={readOnly}
            onChange={(e) =>
              onUpdateItem(index, { ...item, OrderQty: parseInt(e.target.value) || 0 })
            }
            className={getInputClassName(item.OrderQty, "w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-900")}
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
            disabled={readOnly}
            onChange={(e) =>
              onUpdateItem(index, { ...item, Metal: e.target.value })
            }
            className={getInputClassName(item.Metal, "w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-slate-900")}
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
            disabled={readOnly}
            onChange={(e) =>
              onUpdateItem(index, { ...item, Tone: e.target.value })
            }
            className={getInputClassName(item.Tone, "w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-slate-900")}
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
          <select
            value={item.Category || ""}
            disabled={readOnly}
            onChange={(e) =>
              onUpdateItem(index, { ...item, Category: e.target.value })
            }
            className={getInputClassName(item.Category, "w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-slate-900")}
          >
            <option value="">Select category</option>
            <option value="Ring">Ring</option>
            <option value="Band">Band</option>
            <option value="Pendant">Pendant</option>
            <option value="Necklace">Necklace</option>
            <option value="Bracelet">Bracelet</option>
            <option value="Earings">Earings</option>
            <option value="Bangle">Bangle</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Item Size
          </label>
          <input
            type="text"
            value={item.ItemSize || ""}
            disabled={readOnly}
            onChange={(e) =>
              onUpdateItem(index, { ...item, ItemSize: e.target.value || null })
            }
            className={getInputClassName(item.ItemSize, "w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-900")}
            placeholder="Enter item size"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Stock Type
          </label>
          <select
            value={item.StockType || ""}
            disabled={readOnly}
            onChange={(e) =>
              onUpdateItem(index, { ...item, StockType: e.target.value || null })
            }
            className={getInputClassName(item.StockType, "w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-slate-900")}
          >
            <option value="">Select stock type</option>
            <option value="Normal">Normal</option>
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

        <div className="col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Customer Production Instruction
          </label>
          <textarea
            value={item.CustomerProductionInstruction || ""}
            disabled={readOnly}
            onChange={(e) =>
              onUpdateItem(index, { ...item, CustomerProductionInstruction: e.target.value || null })
            }
            rows={3}
            className={getInputClassName(item.CustomerProductionInstruction, "w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-900 resize-y")}
            placeholder="Enter customer production instructions"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Special Remarks
          </label>
          <textarea
            value={item.SpecialRemarks || ""}
            disabled={readOnly}
            onChange={(e) =>
              onUpdateItem(index, { ...item, SpecialRemarks: e.target.value || null })
            }
            rows={3}
            className={getInputClassName(item.SpecialRemarks, "w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-900 resize-y")}
            placeholder="Enter special remarks"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Design Production Instruction
          </label>
          <textarea
            value={item.DesignProductionInstruction || ""}
            disabled={readOnly}
            onChange={(e) =>
              onUpdateItem(index, { ...item, DesignProductionInstruction: e.target.value || null })
            }
            rows={3}
            className={getInputClassName(item.DesignProductionInstruction, "w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-900 resize-y")}
            placeholder="Enter design production instructions"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Stamp Instruction
          </label>
          <textarea
            value={item.StampInstruction || ""}
            disabled={readOnly}
            onChange={(e) =>
              onUpdateItem(index, { ...item, StampInstruction: e.target.value || null })
            }
            rows={3}
            className={getInputClassName(item.StampInstruction, "w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-900 resize-y")}
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
            disabled={readOnly}
            onChange={(e) =>
              onUpdateItem(index, {
                ...item,
                DeadlineDate: e.target.value ? new Date(e.target.value).toISOString() : undefined,
              })
            }
            className={getInputClassName(typeof item.DeadlineDate === 'object' && item.DeadlineDate instanceof Date ? item.DeadlineDate.toISOString() : item.DeadlineDate, "w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-900")}
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
            disabled={readOnly}
            onChange={(e) =>
              onUpdateItem(index, {
                ...item,
                ShippingDate: e.target.value ? new Date(e.target.value).toISOString() : undefined,
              })
            }
            className={getInputClassName(typeof item.ShippingDate === 'object' && item.ShippingDate instanceof Date ? item.ShippingDate.toISOString() : item.ShippingDate, "w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-900")}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Invoice Number
          </label>
          <input
            type="text"
            value={item.InvoiceNumber || ""}
            disabled={readOnly}
            onChange={(e) =>
              onUpdateItem(index, { ...item, InvoiceNumber: e.target.value })
            }
            className={getInputClassName(item.InvoiceNumber, "w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-900")}
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

      {!item.IsIncomplete && !isNewItem && (
        <div className="mt-5 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-green-800 font-medium">
            Completed by: <span className="font-semibold">{item.CompletedByName || "admin"}</span>
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
