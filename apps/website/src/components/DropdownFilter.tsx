"use client";

import React, { useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import type { IFilterComp, IFilterParams } from "ag-grid-community";

export interface DropdownFilterParams extends IFilterParams {
  values: string[];
  onFilterChange?: (value: string | null) => void;
}

const DropdownFilter = forwardRef<IFilterComp, DropdownFilterParams>((params, ref) => {
  const [selectedValue, setSelectedValue] = React.useState<string>("");
  const filterActiveRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
    doesFilterPass() {
      // Return true for all rows - filtering is done server-side
      return true;
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
    
    // Notify parent component of filter change
    if (params.onFilterChange) {
      params.onFilterChange(value || null);
    }
    
    // Notify AG Grid that the filter has changed
    params.api.onFilterChanged();
  };

  const handleClear = () => {
    setSelectedValue("");
    filterActiveRef.current = false;
    
    // Notify parent component of filter change
    if (params.onFilterChange) {
      params.onFilterChange(null);
    }
    
    params.api.onFilterChanged();
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

