"use client";

import { POItem } from "@/types/po";

interface ItemCardProps {
  item: POItem;
  index: number;
  totalItems: number;
  onToggleIncomplete: (index: number) => void;
  onUpdateItem: (index: number, item: POItem) => void;
}

export default function ItemCard({
  item,
  index,
  totalItems,
  onToggleIncomplete,
  onUpdateItem,
}: ItemCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between mb-4 pb-4 border-b">
        <h3 className="text-lg font-semibold text-gray-900">
          Item {index + 1} of {totalItems}
        </h3>
        <div className="flex items-center gap-3">
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
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Client Item Code
          </label>
          <input
            type="text"
            value={item.ClientItemCode}
            onChange={(e) =>
              onUpdateItem(index, { ...item, ClientItemCode: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Chandra Item Code
          </label>
          <input
            type="text"
            value={item.ChandraItemCode || ""}
            onChange={(e) =>
              onUpdateItem(index, { ...item, ChandraItemCode: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Job Bag Number
          </label>
          <input
            type="text"
            value={item.JobBagNumber}
            onChange={(e) =>
              onUpdateItem(index, { ...item, JobBagNumber: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Quantity
          </label>
          <input
            type="number"
            value={item.Quantity}
            onChange={(e) =>
              onUpdateItem(index, { ...item, Quantity: parseInt(e.target.value) || 0 })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={item.Description}
            onChange={(e) =>
              onUpdateItem(index, { ...item, Description: e.target.value })
            }
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Metal Type
          </label>
          <input
            type="text"
            value={item.MetalType}
            onChange={(e) =>
              onUpdateItem(index, { ...item, MetalType: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Metal Color
          </label>
          <input
            type="text"
            value={item.MetalColor}
            onChange={(e) =>
              onUpdateItem(index, { ...item, MetalColor: e.target.value })
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
            value={item.Category}
            onChange={(e) =>
              onUpdateItem(index, { ...item, Category: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Size
          </label>
          <input
            type="text"
            value={item.Size || item.size || ""}
            onChange={(e) =>
              onUpdateItem(index, { ...item, Size: e.target.value, size: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Remarks
          </label>
          <textarea
            value={item.Remarks || ""}
            onChange={(e) =>
              onUpdateItem(index, { ...item, Remarks: e.target.value })
            }
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Stamping Instructions
          </label>
          <textarea
            value={item.StampingInstructions || ""}
            onChange={(e) =>
              onUpdateItem(index, { ...item, StampingInstructions: e.target.value })
            }
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={item.StampRequired}
            onChange={(e) =>
              onUpdateItem(index, { ...item, StampRequired: e.target.checked })
            }
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label className="text-sm font-medium text-gray-700">Stamp Required</label>
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

      {item.IsIncomplete && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800 font-medium">
            ⚠️ This item is marked as incomplete
          </p>
        </div>
      )}
    </div>
  );
}
