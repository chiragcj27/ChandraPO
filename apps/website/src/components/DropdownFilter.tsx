"use client";

import React, { useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import type { IFilterComp, IFilterParams, IDoesFilterPassParams } from "ag-grid-community";

export interface DropdownFilterParams extends IFilterParams {
  values: string[];
}

const DropdownFilter = forwardRef<IFilterComp, DropdownFilterParams>((params, ref) => {
  const [selectedValue, setSelectedValue] = React.useState<string>("");
  const filterActiveRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<string | undefined>(params.colDef.field);

  useImperativeHandle(ref, () => ({
    isFilterActive() {
      return filterActiveRef.current;
    },
    getModel() {
      if (!filterActiveRef.current) {
        return null;
      }
      return {
        filterType: "equals",
        filter: selectedValue || null,
      };
    },
    setModel(model: { filterType: string; filter: string | null } | null) {
      if (model && model.filter) {
        setSelectedValue(model.filter);
        filterActiveRef.current = true;
      } else {
        setSelectedValue("");
        filterActiveRef.current = false;
      }
    },
    doesFilterPass(filterParams: IDoesFilterPassParams) {
      if (!filterActiveRef.current || !selectedValue) {
        return true;
      }
      const field = fieldRef.current;
      if (!field) return true;
      const cellValue = filterParams.data[field];
      return String(cellValue) === String(selectedValue);
    },
    getModelAsString() {
      if (!filterActiveRef.current || !selectedValue) {
        return "";
      }
      return `Equals ${selectedValue}`;
    },
    getGui() {
      return containerRef.current!;
    },
    onNewRowsLoaded() {
      // Optional: refresh filter when new rows are loaded
    },
    onAnyFilterChanged() {
      // Optional: handle when other filters change
    },
  }));

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedValue(value);
    filterActiveRef.current = value !== "";
    
    // Notify AG Grid that the filter has changed
    params.filterChangedCallback();
  };

  const handleClear = () => {
    setSelectedValue("");
    filterActiveRef.current = false;
    params.filterChangedCallback();
  };

  return (
    <div ref={containerRef} className="p-2 min-w-[200px]">
      <div className="mb-2">
        <select
          value={selectedValue}
          onChange={handleChange}
          className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">All</option>
          {params.values.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      {filterActiveRef.current && (
        <button
          onClick={handleClear}
          className="w-full px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
        >
          Clear Filter
        </button>
      )}
    </div>
  );
});

DropdownFilter.displayName = "DropdownFilter";

export default DropdownFilter;

