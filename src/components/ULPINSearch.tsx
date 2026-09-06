"use client";

import { useState } from "react";
import type { ParsedBuilding } from "@/src/lib/parser/types";

export default function ULPINSearch({
  building,
  onSelectProperty,
}: {
  building: ParsedBuilding;
  onSelectProperty: (propertyId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [notFound, setNotFound] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setNotFound(false);

    if (!query.trim()) return;

    // Search units across all floors by ID, unit number, or ULPIN
    const foundUnit = building.floors
      .flatMap((f) => f.units)
      .find(
        (unit) =>
          unit.id.toLowerCase() === query.trim().toLowerCase() ||
          unit.unitNumber.toLowerCase() === query.trim().toLowerCase() ||
          unit.ulpin?.toLowerCase() === query.trim().toLowerCase()
      );

    if (foundUnit) {
      onSelectProperty(foundUnit.id);
    } else {
      setNotFound(true);
    }
  };

  return (
    <div
      style={{
        padding: "16px",
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        marginBottom: "20px",
      }}
    >
      <form onSubmit={handleSearch} style={{ display: "flex", gap: "10px" }}>
        <input
          type="text"
          placeholder="Search by ULPIN, Property ID, or Unit # (e.g. 101)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setNotFound(false);
          }}
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: "8px",
            border: "1px solid #cbd5e1",
            fontSize: "13px",
            outline: "none",
          }}
        />
        <button
          type="submit"
          style={{
            padding: "10px 18px",
            borderRadius: "8px",
            border: "none",
            background: "#2563eb",
            color: "#ffffff",
            fontWeight: 700,
            fontSize: "13px",
            cursor: "pointer",
          }}
        >
          Locate Property
        </button>
      </form>

      {notFound && (
        <div style={{ marginTop: "8px", fontSize: "12px", color: "#dc2626", fontWeight: 600 }}>
          ✕ No matching property found for "{query}".
        </div>
      )}
    </div>
  );
}