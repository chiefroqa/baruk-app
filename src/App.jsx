import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabase";

// Inject Google Font
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap";
document.head.appendChild(fontLink);

// ============================================================
// DATABASE SCHEMA (Supabase/PostgreSQL)
// ============================================================
/*
-- USERS TABLE
create table users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text unique not null,
  role text check (role in ('customer','rider','admin')) not null,
  home_zone text, -- for riders only
  created_at timestamptz default now()
);

-- PACKAGES TABLE
create table packages (
  id uuid primary key default gen_random_uuid(),
  tracking_code text unique not null,
  customer_id uuid references users(id),
  rider_collection_id uuid references users(id),  -- rider who picked up from customer
  rider_delivery_id uuid references users(id),    -- rider delivering to final customer
  pickup_address text not null,
  delivery_address text not null,
  delivery_zone text not null,
  description text not null,
  size text check (size in ('small','medium','large')) default 'small',
  weight_kg numeric default 1,
  declared_value numeric not null default 0,
  base_rate numeric not null default 200,
  protection_fee numeric not null default 0,
  total_fee numeric not null default 200,
  is_high_value boolean default false,
  status text check (status in (
    'searching_rider','picked_up','at_warehouse','out_for_delivery','delivered','cancelled'
  )) default 'searching_rider',
  otp_warehouse text,       -- 4-digit OTP for warehouse handoff
  otp_delivery text,        -- 4-digit OTP for final delivery handoff
  otp_warehouse_verified boolean default false,
  otp_delivery_verified boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- TRANSIT_LOGS TABLE (Chain of Custody)
create table transit_logs (
  id uuid primary key default gen_random_uuid(),
  package_id uuid references packages(id),
  actor_id uuid references users(id),
  actor_role text not null,
  event text not null,  -- e.g. 'COLLECTED_FROM_CUSTOMER', 'ARRIVED_AT_WAREHOUSE', 'DISPATCHED_TO_RIDER', 'DELIVERED'
  location text,
  notes text,
  created_at timestamptz default now()
);

-- REALTIME: Enable Supabase Realtime on packages and transit_logs tables
-- alter publication supabase_realtime add table packages;
-- alter publication supabase_realtime add table transit_logs;

-- ROW LEVEL SECURITY examples:
-- Customers see only their own packages
-- Riders see packages in their zone
-- Admins see everything
*/

// ============================================================
// MOCK DATA & STATE ENGINE
// ============================================================
// ZONE PRICING — THREE TIER MODEL
// ============================================================
const ZONE_DATA = {
  // ── Zone 1: Inner Circle — KES 200 ──────────────────────────
  "City Centre":     { tier: 1, base: 200, riderPay: 70, label: "City Centre" },
  "River Road":      { tier: 1, base: 200, riderPay: 70, label: "River Road" },
  "Ngara":           { tier: 1, base: 200, riderPay: 70, label: "Ngara" },
  "Pangani":         { tier: 1, base: 200, riderPay: 70, label: "Pangani" },
  "Parklands":       { tier: 1, base: 200, riderPay: 70, label: "Parklands" },
  "Highridge":       { tier: 1, base: 200, riderPay: 70, label: "Highridge" },
  "Riverside":       { tier: 1, base: 200, riderPay: 70, label: "Riverside" },
  "Rhapta Road":     { tier: 1, base: 200, riderPay: 70, label: "Rhapta Road" },
  "Upper Hill":      { tier: 1, base: 200, riderPay: 70, label: "Upper Hill" },
  "Hurlingham":      { tier: 1, base: 200, riderPay: 70, label: "Hurlingham" },
  "Milimani":        { tier: 1, base: 200, riderPay: 70, label: "Milimani" },
  "Adams Arcade":    { tier: 1, base: 200, riderPay: 70, label: "Adams Arcade" },
  "Lavington":       { tier: 1, base: 200, riderPay: 70, label: "Lavington" },
  "Kileleshwa":      { tier: 1, base: 200, riderPay: 70, label: "Kileleshwa" },
  "Muthangari":      { tier: 1, base: 200, riderPay: 70, label: "Muthangari" },
  "Valley Arcade":   { tier: 1, base: 200, riderPay: 70, label: "Valley Arcade" },
  "South C":         { tier: 1, base: 200, riderPay: 70, label: "South C" },
  "South B":         { tier: 1, base: 200, riderPay: 70, label: "South B" },
  "Hazina":          { tier: 1, base: 200, riderPay: 70, label: "Hazina" },
  "Plainsview":      { tier: 1, base: 200, riderPay: 70, label: "Plainsview" },
  "Makadara":        { tier: 1, base: 200, riderPay: 70, label: "Makadara" },
  "Jogoo Road":      { tier: 1, base: 200, riderPay: 70, label: "Jogoo Road" },
  "Doonholm":        { tier: 1, base: 200, riderPay: 70, label: "Doonholm" },
  "Buruburu":        { tier: 1, base: 200, riderPay: 70, label: "Buruburu" },

  // ── Zone 2: Mid-Tier — KES 250 ──────────────────────────────
  "Roysambu":        { tier: 2, base: 250, riderPay: 90, label: "Roysambu" },
  "Kasarani":        { tier: 2, base: 250, riderPay: 90, label: "Kasarani" },
  "Zimmerman":       { tier: 2, base: 250, riderPay: 90, label: "Zimmerman" },
  "Githurai 44/45":  { tier: 2, base: 250, riderPay: 90, label: "Githurai 44/45" },
  "Embakasi":        { tier: 2, base: 250, riderPay: 90, label: "Embakasi" },
  "Imara Daima":     { tier: 2, base: 250, riderPay: 90, label: "Imara Daima" },
  "Pipeline":        { tier: 2, base: 250, riderPay: 90, label: "Pipeline" },
  "Syokimau":        { tier: 2, base: 250, riderPay: 90, label: "Syokimau" },
  "Kangemi":         { tier: 2, base: 250, riderPay: 90, label: "Kangemi" },
  "Loresho":         { tier: 2, base: 250, riderPay: 90, label: "Loresho" },
  "Mountain View":   { tier: 2, base: 250, riderPay: 90, label: "Mountain View" },
  "Uthiru":          { tier: 2, base: 250, riderPay: 90, label: "Uthiru" },
  "Langata":         { tier: 2, base: 250, riderPay: 90, label: "Langata" },
  "Karen":           { tier: 2, base: 250, riderPay: 90, label: "Karen" },
  "Hardy":           { tier: 2, base: 250, riderPay: 90, label: "Hardy" },
  "Galleria":        { tier: 2, base: 250, riderPay: 90, label: "Galleria" },
  "Umoja":           { tier: 2, base: 250, riderPay: 90, label: "Umoja" },
  "Innercore":       { tier: 2, base: 250, riderPay: 90, label: "Innercore" },
  "Komarock":        { tier: 2, base: 250, riderPay: 90, label: "Komarock" },
  "Kayole":          { tier: 2, base: 250, riderPay: 90, label: "Kayole" },
  "Njiru":           { tier: 2, base: 250, riderPay: 90, label: "Njiru" },
  "Ridgeways":       { tier: 2, base: 250, riderPay: 90, label: "Ridgeways" },
  "Muthaiga North":  { tier: 2, base: 250, riderPay: 90, label: "Muthaiga North" },
  "Garden Estate":   { tier: 2, base: 250, riderPay: 90, label: "Garden Estate" },

  // ── Zone 3: Outer Tier — KES 300 ────────────────────────────
  "Ongata Rongai":   { tier: 3, base: 300, riderPay: 110, label: "Ongata Rongai" },
  "Kiserian":        { tier: 3, base: 300, riderPay: 110, label: "Kiserian" },
  "Ngong Town":      { tier: 3, base: 300, riderPay: 110, label: "Ngong Town" },
  "Bulbul":          { tier: 3, base: 300, riderPay: 110, label: "Bulbul" },
  "Ruiru":           { tier: 3, base: 300, riderPay: 110, label: "Ruiru" },
  "Kenyatta Uni":    { tier: 3, base: 300, riderPay: 110, label: "Kenyatta Uni" },
  "Juja":            { tier: 3, base: 300, riderPay: 110, label: "Juja" },
  "Kitengela":       { tier: 3, base: 300, riderPay: 110, label: "Kitengela" },
  "Athi River":      { tier: 3, base: 300, riderPay: 110, label: "Athi River" },
  "Mlolongo":        { tier: 3, base: 300, riderPay: 110, label: "Mlolongo" },
  "Kiambu Town":     { tier: 3, base: 300, riderPay: 110, label: "Kiambu Town" },
  "Thindigua":       { tier: 3, base: 300, riderPay: 110, label: "Thindigua" },
  "Kirigiti":        { tier: 3, base: 300, riderPay: 110, label: "Kirigiti" },
  "Kikuyu":          { tier: 3, base: 300, riderPay: 110, label: "Kikuyu" },
  "Sigona":          { tier: 3, base: 300, riderPay: 110, label: "Sigona" },
  "Zambezi":         { tier: 3, base: 300, riderPay: 110, label: "Zambezi" },
  "Ruai":            { tier: 3, base: 300, riderPay: 110, label: "Ruai" },
  "Kamulu":          { tier: 3, base: 300, riderPay: 110, label: "Kamulu" },
  "Utawala":         { tier: 3, base: 300, riderPay: 110, label: "Utawala" },
};

// Grouped for the zone picker UI
const ZONE_GROUPS = [
  {
    tier: 1, label: "Zone 1 — Inner Circle", color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0", price: 200,
    zones: Object.entries(ZONE_DATA).filter(([,v]) => v.tier === 1).map(([k]) => k),
  },
  {
    tier: 2, label: "Zone 2 — Mid-Tier", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", price: 250,
    zones: Object.entries(ZONE_DATA).filter(([,v]) => v.tier === 2).map(([k]) => k),
  },
  {
    tier: 3, label: "Zone 3 — Outer", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", price: 300,
    zones: Object.entries(ZONE_DATA).filter(([,v]) => v.tier === 3).map(([k]) => k),
  },
];

// Flat list for dropdowns
const ZONES = Object.keys(ZONE_DATA);

// Get zone info — defaults to Zone 1 if not found
const getZoneInfo = (zoneName) => ZONE_DATA[zoneName] || { tier: 1, base: 200, riderPay: 70 };

const TIER_BADGE = {
  1: { label: "Zone 1 · Inner", color: "#16A34A", bg: "#F0FDF4" },
  2: { label: "Zone 2 · Mid",   color: "#D97706", bg: "#FFFBEB" },
  3: { label: "Zone 3 · Outer", color: "#DC2626", bg: "#FEF2F2" },
};

const generateOTP = () => Math.floor(1000 + Math.random() * 9000).toString();
const generateTracking = () => "BRK-" + Math.random().toString(36).substring(2,8).toUpperCase();

const calcFees = (declaredValue, zoneName = "City Centre") => {
  const zone         = getZoneInfo(zoneName);
  const base         = zone.base;
  const riderPay     = zone.riderPay;
  const protectionFee = declaredValue > 5000 ? Math.round(declaredValue * 0.015) : 0;
  const isHighValue  = declaredValue > 10000;
  return { base, riderPay, protectionFee, total: base + protectionFee, isHighValue, tier: zone.tier };
};

const initialPackages = [
  {
    id: "pkg-001", trackingCode: "MHB-ALPHA1", customerId: "cust-01",
    customerName: "Amara Osei", riderCollectionId: "rider-01", riderDeliveryId: null,
    pickupAddress: "Sarit Centre, Westlands", deliveryAddress: "Garden City Mall, Kasarani",
    deliveryZone: "Kasarani", description: "Laptop bag", size: "medium",
    declaredValue: 8500, base: 200, protectionFee: 128, total: 328,
    isHighValue: false, status: "at_warehouse",
    otpWarehouse: "7423", otpDelivery: "3891",
    otpWarehouseVerified: true, otpDeliveryVerified: false,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "pkg-002", trackingCode: "MHB-BETA22", customerId: "cust-02",
    customerName: "Njeri Kamau", riderCollectionId: "rider-02", riderDeliveryId: null,
    pickupAddress: "Ngong Hills Estate", deliveryAddress: "Eastgate Mall, Embakasi",
    deliveryZone: "Embakasi", description: "Electronics package", size: "small",
    declaredValue: 15000, base: 200, protectionFee: 225, total: 425,
    isHighValue: true, status: "at_warehouse",
    otpWarehouse: "5512", otpDelivery: "2267",
    otpWarehouseVerified: false, otpDeliveryVerified: false,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: "pkg-003", trackingCode: "MHB-GAMMA3", customerId: "cust-03",
    customerName: "David Otieno", riderCollectionId: "rider-01", riderDeliveryId: "rider-03",
    pickupAddress: "Muthaiga Road", deliveryAddress: "Two Rivers Mall, Ruiru",
    deliveryZone: "Ruiru", description: "Fashion items", size: "large",
    declaredValue: 3200, base: 200, protectionFee: 0, total: 200,
    isHighValue: false, status: "out_for_delivery",
    otpWarehouse: null, otpDelivery: null,
    otpWarehouseVerified: false, otpDeliveryVerified: false,
    createdAt: new Date(Date.now() - 5400000).toISOString(),
  },
];

const initialLogs = [
  { id: "log-001", packageId: "pkg-001", actorId: "rider-01", actorRole: "rider", actorName: "Kip Mutai", event: "COLLECTED_FROM_CUSTOMER", location: "Sarit Centre, Westlands", notes: "Package in good condition", createdAt: new Date(Date.now() - 3600000).toISOString() },
  { id: "log-002", packageId: "pkg-001", actorId: "rider-01", actorRole: "rider", actorName: "Kip Mutai", event: "ARRIVED_AT_WAREHOUSE", location: "Baruk Central, CBD", notes: null, createdAt: new Date(Date.now() - 2400000).toISOString() },
  { id: "log-003", packageId: "pkg-002", actorId: "rider-02", actorRole: "rider", actorName: "Faith Wanjiru", event: "COLLECTED_FROM_CUSTOMER", location: "Ngong Hills Estate", notes: "Sealed electronics box", createdAt: new Date(Date.now() - 7200000).toISOString() },
  { id: "log-004", packageId: "pkg-002", actorId: "rider-02", actorRole: "rider", actorName: "Faith Wanjiru", event: "ARRIVED_AT_WAREHOUSE", location: "Baruk Central, CBD", notes: "High value - OTP required", createdAt: new Date(Date.now() - 6000000).toISOString() },
  { id: "log-005", packageId: "pkg-003", actorId: "rider-01", actorRole: "rider", actorName: "Kip Mutai", event: "COLLECTED_FROM_CUSTOMER", location: "Muthaiga Road", notes: null, createdAt: new Date(Date.now() - 5400000).toISOString() },
  { id: "log-006", packageId: "pkg-003", actorId: "admin-01", actorRole: "admin", actorName: "Admin Hub", event: "DISPATCHED_TO_RIDER", location: "Baruk Central, CBD", notes: "Dispatched to Rider Zawadi", createdAt: new Date(Date.now() - 3000000).toISOString() },
  { id: "log-007", packageId: "pkg-003", actorId: "rider-03", actorRole: "rider", actorName: "Zawadi Mwangi", event: "OUT_FOR_DELIVERY", location: "Baruk Central, CBD", notes: null, createdAt: new Date(Date.now() - 2700000).toISOString() },
];

const RIDERS = [
  { id: "rider-01", name: "Kip Mutai", phone: "0712345001", zone: "Westlands", role: "rider" },
  { id: "rider-02", name: "Faith Wanjiru", phone: "0712345002", zone: "Ngong", role: "rider" },
  { id: "rider-03", name: "Zawadi Mwangi", phone: "0712345003", zone: "Ruiru", role: "rider" },
  { id: "rider-04", name: "Brian Omondi", phone: "0712345004", zone: "Kasarani", role: "rider" },
];

// ============================================================
// UTILITY COMPONENTS
// ============================================================
const StatusBadge = ({ status }) => {
  const config = {
    pickup_requested:  { label: "Pickup Requested",   color: "#8B5CF6", bg: "#EDE9FE" },
    searching_rider:   { label: "Searching Rider",     color: "#F59E0B", bg: "#FEF3C7" },
    awaiting_collection:{ label: "Rider En Route",     color: "#0EA5E9", bg: "#E0F2FE" },
    picked_up:         { label: "Picked Up",           color: "#F87171", bg: "#FEF2F2" },
    pending_warehouse: { label: "Pending Acceptance",  color: "#8B5CF6", bg: "#EEF2FF" },
    at_warehouse:      { label: "At Warehouse",        color: "#6366F1", bg: "#EEF2FF" },
    out_for_delivery:  { label: "Out for Delivery",    color: "#10B981", bg: "#D1FAE5" },
    pending_delivery:  { label: "Pending Confirmation",color: "#F97316", bg: "#FFF7ED" },
    delivered:         { label: "Delivered",           color: "#059669", bg: "#ECFDF5" },
    cancelled:         { label: "Cancelled",           color: "#EF4444", bg: "#FEE2E2" },
  };
  const c = config[status] || { label: status, color: "#6B7280", bg: "#F3F4F6" };
  return (
    <span style={{ background: c.bg, color: c.color, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
      {c.label}
    </span>
  );
};

const HighValueBadge = () => (
  <span style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600, letterSpacing: "0.06em" }}>
    ⚡ HIGH VALUE
  </span>
);

const Card = ({ children, style = {}, onClick }) => (
  <div onClick={onClick} style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.07), 0 4px 20px rgba(0,0,0,0.04)", ...(onClick ? { cursor: "pointer" } : {}), ...style }}>
    {children}
  </div>
);

const Btn = ({ children, onClick, variant = "primary", size = "md", disabled = false, style = {} }) => {
  const base = { cursor: disabled ? "not-allowed" : "pointer", border: "none", borderRadius: 10, fontWeight: 700, fontFamily: "inherit", transition: "all 0.15s", opacity: disabled ? 0.5 : 1 };
  const sizes = { sm: { padding: "6px 14px", fontSize: 13 }, md: { padding: "10px 20px", fontSize: 14 }, lg: { padding: "14px 28px", fontSize: 16 } };
  const variants = {
    primary:   { background: "#DC2626", color: "#fff", boxShadow: "0 2px 8px rgba(220,38,38,0.3)" },
    secondary: { background: "#F3F4F6", color: "#374151" },
    success:   { background: "#10B981", color: "#fff" },
    danger:    { background: "#EF4444", color: "#fff" },
    ghost:     { background: "transparent", color: "#6B7280", border: "1.5px solid #E5E7EB" },
    purple:    { background: "#7C3AED", color: "#fff", boxShadow: "0 2px 8px rgba(124,58,237,0.3)" },
  };
  return (
    <button onClick={disabled ? undefined : onClick} style={{ ...base, ...sizes[size], ...variants[variant], ...style }}>
      {children}
    </button>
  );
};

const Input = ({ label, value, onChange, type = "text", placeholder = "", readOnly = false, style = {} }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>}
    <input
      type={type} value={value} onChange={e => onChange && onChange(e.target.value)}
      placeholder={placeholder} readOnly={readOnly}
      style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, fontFamily: "inherit", background: readOnly ? "#F9FAFB" : "#fff", color: "#111827", boxSizing: "border-box", outline: "none", ...style }}
    />
  </div>
);

const Select = ({ label, value, onChange, options }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>}
    <select value={value} onChange={e => onChange(e.target.value)} style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, fontFamily: "inherit", background: "#fff", color: "#111827", boxSizing: "border-box" }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const Stat = ({ label, value, sub, color = "#DC2626" }) => (
  <div style={{ textAlign: "center" }}>
    <div style={{ fontSize: 28, fontWeight: 600, color, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
    {sub && <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{sub}</div>}
  </div>
);

const Timeline = ({ logs }) => (
  <div style={{ position: "relative" }}>
    {logs.map((log, i) => (
      <div key={log.id} style={{ display: "flex", gap: 12, marginBottom: i < logs.length - 1 ? 16 : 0 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#DC2626", marginTop: 4, flexShrink: 0 }} />
          {i < logs.length - 1 && <div style={{ width: 2, flex: 1, background: "#E5E7EB", marginTop: 4 }} />}
        </div>
        <div style={{ paddingBottom: i < logs.length - 1 ? 16 : 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{log.event.replace(/_/g, " ")}</div>
          <div style={{ fontSize: 12, color: "#6B7280" }}>{log.actorName} • {log.location}</div>
          <div style={{ fontSize: 11, color: "#9CA3AF" }}>{new Date(log.createdAt).toLocaleString()}</div>
          {log.notes && <div style={{ fontSize: 12, color: "#DC2626", marginTop: 2, fontStyle: "italic" }}>"{log.notes}"</div>}
        </div>
      </div>
    ))}
  </div>
);

// ============================================================
// CUSTOMER APP
// ============================================================
// M-PESA CONFIG
// ============================================================
const MPESA_TILL    = "8036678";
const MPESA_NAME    = "Coral Crafts";

// ============================================================
// CUSTOMER APP
// ============================================================
function CustomerApp({ packages, onCreatePackage, transitLogs }) {
  const [view, setView]             = useState("track");
  const [orderType, setOrderType]   = useState("delivery"); // "delivery" | "pickup_request"
  const [form, setForm]             = useState({ pickupAddress: "", deliveryAddress: "", deliveryZone: ZONES[0], description: "", size: "small", declaredValue: "", collectFromName: "", collectFromPhone: "" });
  const [expandedPkg, setExpandedPkg] = useState(null);

  // Payment flow stages: "form" → "payment" → "done"
  const [stage, setStage]           = useState("form");
  const [pendingPkg, setPendingPkg] = useState(null);
  const [mpesaCode, setMpesaCode]   = useState("");
  const [codeError, setCodeError]   = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fees = calcFees(parseFloat(form.declaredValue) || 0, form.deliveryZone);
  const isPickup = orderType === "pickup_request";
  const canSubmit = isPickup
    ? (form.pickupAddress && form.deliveryAddress && form.description && form.collectFromName)
    : (form.pickupAddress && form.deliveryAddress && form.description);

  const resetForm = () => {
    setForm({ pickupAddress: "", deliveryAddress: "", deliveryZone: ZONES[0], description: "", size: "small", declaredValue: "", collectFromName: "", collectFromPhone: "" });
  };

  // Step 1 — customer fills form and clicks Book
  const handleBook = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const pkg = await onCreatePackage({ ...form, requestType: orderType, paymentStatus: "pending" });
    setPendingPkg(pkg);
    setStage("payment");
    setSubmitting(false);
    resetForm();
  };

  // Step 2 — customer pastes their M-Pesa confirmation code
  const handleConfirmPayment = () => {
    setCodeError("");
    const code = mpesaCode.trim().toUpperCase();
    // M-Pesa codes are 10 alphanumeric characters e.g. QHX4RT7K9P
    if (code.length < 8) return setCodeError("Please enter a valid M-Pesa confirmation code.");
    setStage("done");
  };

  const handleNewOrder = () => {
    setStage("form");
    setPendingPkg(null);
    setMpesaCode("");
    resetForm();
    setView("new");
  };

  const TrackingProgress = ({ status }) => {
    const steps  = ["searching_rider","awaiting_collection","picked_up","pending_warehouse","at_warehouse","out_for_delivery","pending_delivery","delivered"];
    const labels = ["Searching","En Route","Picked Up","At Hub","Accepted","Out","Confirming","Delivered"];
    const idx    = steps.indexOf(status);
    return (
      <div style={{ display: "flex", alignItems: "center", margin: "16px 0" }}>
        {steps.map((s, i) => (
          <div key={s} style={{ display: "flex", alignItems: "center", flex: 1 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: i <= idx ? "#DC2626" : "#E5E7EB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: i <= idx ? "#fff" : "#9CA3AF", fontWeight: 700, flexShrink: 0 }}>
                {i < idx ? "✓" : i + 1}
              </div>
              <div style={{ fontSize: 9, textAlign: "center", color: i <= idx ? "#DC2626" : "#9CA3AF", fontWeight: i === idx ? 800 : 500, marginTop: 4, lineHeight: 1.2, width: 52 }}>{labels[i]}</div>
            </div>
            {i < steps.length - 1 && <div style={{ height: 2, flex: 1, background: i < idx ? "#DC2626" : "#E5E7EB", margin: "0 2px", marginBottom: 20, flexShrink: 0 }} />}
          </div>
        ))}
      </div>
    );
  };

  // ── Payment screen ──────────────────────────────────────────
  if (stage === "payment" && pendingPkg) {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", fontFamily: "'DM Sans', system-ui, sans-serif", padding: 20 }}>
        {/* Progress steps */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 28 }}>
          {[["1","Book"],["2","Pay"],["3","Done"]].map(([n, label], i) => (
            <div key={n} style={{ display: "flex", alignItems: "center", flex: 1 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: i === 0 ? "#10B981" : i === 1 ? "#DC2626" : "#E5E7EB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#fff", fontWeight: 800 }}>
                  {i === 0 ? "✓" : n}
                </div>
                <div style={{ fontSize: 11, color: i === 1 ? "#DC2626" : "#9CA3AF", fontWeight: i === 1 ? 800 : 600, marginTop: 4 }}>{label}</div>
              </div>
              {i < 2 && <div style={{ height: 2, flex: 1, background: i === 0 ? "#10B981" : "#E5E7EB", marginBottom: 20 }} />}
            </div>
          ))}
        </div>

        {/* Order summary */}
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Order Summary</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: "#6B7280" }}>Tracking</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#111827", fontFamily: "monospace" }}>{pendingPkg.trackingCode}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: "#6B7280" }}>Item</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{pendingPkg.description}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid #F3F4F6", marginTop: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>Amount Due</span>
            <span style={{ fontSize: 18, fontWeight: 900, color: "#DC2626" }}>KES {pendingPkg.total}</span>
          </div>
        </Card>

        {/* M-Pesa payment instructions */}
        <Card style={{ background: "#F0FDF4", border: "1.5px solid #6EE7B7", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#16A34A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>📱</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 900, color: "#14532D" }}>Pay via M-Pesa</div>
              <div style={{ fontSize: 12, color: "#16A34A" }}>Lipa Na M-Pesa · Buy Goods</div>
            </div>
          </div>

          {[
            ["Open M-Pesa", "Go to M-Pesa on your phone"],
            ["Select", "Lipa Na M-Pesa → Buy Goods & Services"],
            ["Till Number", MPESA_TILL],
            ["Business Name", MPESA_NAME],
            ["Amount", `KES ${pendingPkg.total}`],
            ["Reference", pendingPkg.trackingCode],
          ].map(([label, value], i) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingVertical: 6, borderBottom: i < 5 ? "1px solid #DCFCE7" : "none", paddingBottom: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: "#16A34A", fontWeight: 700 }}>{label}</span>
              <span style={{ fontSize: i >= 2 ? 15 : 13, fontWeight: i >= 2 ? 900 : 600, color: "#14532D", letterSpacing: i === 2 ? 2 : 0 }}>{value}</span>
            </div>
          ))}

          <div style={{ background: "#DCFCE7", borderRadius: 8, padding: "10px 12px", marginTop: 8 }}>
            <div style={{ fontSize: 12, color: "#14532D", fontWeight: 700 }}>
              ⚠️ Use your tracking code <strong>{pendingPkg.trackingCode}</strong> as the reference so we can match your payment.
            </div>
          </div>
        </Card>

        {/* Confirmation code input */}
        <Card>
          <div style={{ fontSize: 14, fontWeight: 900, color: "#111827", marginBottom: 4 }}>Paid? Enter your confirmation code</div>
          <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 14 }}>After paying you'll receive an SMS from M-Pesa with a code like <strong>QHX4RT7K9P</strong></div>
          <input
            value={mpesaCode} onChange={e => setMpesaCode(e.target.value.toUpperCase())}
            placeholder="e.g. QHX4RT7K9P" maxLength={12}
            style={{ width: "100%", padding: "12px 14px", border: `1.5px solid ${codeError ? "#EF4444" : "#E5E7EB"}`, borderRadius: 10, fontSize: 18, fontFamily: "monospace", fontWeight: 800, letterSpacing: 3, boxSizing: "border-box", outline: "none", color: "#111827", textTransform: "uppercase" }}
            onFocus={e => e.target.style.borderColor = "#DC2626"}
            onBlur={e => e.target.style.borderColor = codeError ? "#EF4444" : "#E5E7EB"}
          />
          {codeError && <div style={{ color: "#EF4444", fontSize: 13, fontWeight: 600, marginTop: 6 }}>⚠️ {codeError}</div>}
          <Btn onClick={handleConfirmPayment} style={{ width: "100%", marginTop: 14 }} size="lg" disabled={!mpesaCode}>Confirm Payment</Btn>
        </Card>

        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button onClick={() => { setStage("form"); setView("track"); }} style={{ fontSize: 13, color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
            I'll pay later — track my order →
          </button>
        </div>
      </div>
    );
  }

  // ── Done / success screen ───────────────────────────────────
  if (stage === "done" && pendingPkg) {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", fontFamily: "'DM Sans', system-ui, sans-serif", padding: 20 }}>
        <div style={{ textAlign: "center", paddingTop: 40, paddingBottom: 32 }}>
          <div style={{ fontSize: 72, marginBottom: 16 }}>🎉</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#111827", marginBottom: 8 }}>Payment Confirmed!</div>
          <div style={{ fontSize: 15, color: "#6B7280", marginBottom: 24 }}>{pendingPkg?.requestType === "pickup_request" ? "Your pickup request is live. A rider will head to the seller shortly." : "Your delivery is now active. A rider will be assigned shortly."}</div>
          <Card style={{ textAlign: "left", marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Booking Details</div>
            {[
              ["Tracking Code", pendingPkg.trackingCode],
              ["M-Pesa Code",   mpesaCode],
              ["Amount Paid",   `KES ${pendingPkg.total}`],
              ...(pendingPkg?.requestType === "pickup_request" ? [["Collect From", pendingPkg.collectFromName], ["Shop Address", pendingPkg.pickupAddress]] : []),
              ["Delivering to", pendingPkg.deliveryAddress],
            ].filter(([,v]) => v).map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: "#6B7280" }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#111827", fontFamily: label === "Tracking Code" || label === "M-Pesa Code" ? "monospace" : "inherit" }}>{value}</span>
              </div>
            ))}
          </Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Btn onClick={() => { setStage("form"); setView("track"); setPendingPkg(null); setMpesaCode(""); }} variant="primary" size="lg" style={{ width: "100%" }}>Track My Order →</Btn>
            <Btn onClick={handleNewOrder} variant="ghost" size="md" style={{ width: "100%" }}>Book Another Delivery</Btn>
          </div>
        </div>
      </div>
    );
  }

  // ── Main view ───────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 480, margin: "0 auto", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#fff", padding: "20px 20px 0", borderRadius: "0 0 24px 24px", borderBottom: "2px solid #FECACA", boxShadow: "0 2px 16px rgba(220,38,38,0.08)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#DC2626", letterSpacing: "-0.5px" }}>Baruk</div>
            <div style={{ fontSize: 12, color: "#EF4444" }}>Fast. Reliable. Trackable.</div>
          </div>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#FEE2E2", border: "1.5px solid #FECACA", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>👤</div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {[["track","📦 My Orders"],["new","＋ Send Parcel"],["pickup","🛵 Request Pickup"]].map(([v, label]) => (
            <button key={v} onClick={() => { setView(v === "pickup" ? "new" : v); if (v === "pickup") setOrderType("pickup_request"); if (v === "new") setOrderType("delivery"); }} style={{ flex: 1, padding: "10px 0", border: "none", background: (view === "new" && v === "new" && orderType === "delivery") || (view === "new" && v === "pickup" && orderType === "pickup_request") || (view === v && v === "track") ? "#DC2626" : "transparent", color: (view === "new" && v === "new" && orderType === "delivery") || (view === "new" && v === "pickup" && orderType === "pickup_request") || (view === v && v === "track") ? "#fff" : "#DC2626", fontWeight: 700, borderRadius: "10px 10px 0 0", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "20px 16px" }}>
        {view === "new" ? (
          <div>
            {isPickup ? (
              <div style={{ background: "#EDE9FE", border: "1.5px solid #C4B5FD", borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#5B21B6", marginBottom: 4 }}>🛵 Pickup Request</div>
                <div style={{ fontSize: 13, color: "#6D28D9", lineHeight: 1.5 }}>Tell us where to collect your item from — a shop, tailor, supplier, or anywhere in Nairobi — and we'll bring it straight to your door.</div>
              </div>
            ) : (
              <div style={{ background: "#FEF2F2", border: "1.5px solid #FECACA", borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#991B1B", marginBottom: 4 }}>📦 Send a Parcel</div>
                <div style={{ fontSize: 13, color: "#DC2626", lineHeight: 1.5 }}>Book a rider to collect a package from an address and deliver it to the recipient.</div>
              </div>
            )}
            <h2 style={{ fontSize: 18, fontWeight: 900, color: "#111827", marginBottom: 16, marginTop: 0 }}>{isPickup ? "Where should we collect from?" : "Book a Delivery"}</h2>
            <Card>
              {isPickup && (
                <>
                  <div style={{ marginBottom: 14, padding: "12px 14px", background: "#F5F3FF", borderRadius: 10, border: "1px solid #DDD6FE" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#7C3AED", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>📍 Collect From</div>
                    <Input label="Shop / Seller Name" value={form.collectFromName} onChange={v => setForm(f => ({...f, collectFromName: v}))} placeholder="e.g. Zara Westgate, City Mall Tailors" />
                    <Input label="Collection Address" value={form.pickupAddress} onChange={v => setForm(f => ({...f, pickupAddress: v}))} placeholder="Full address of the shop or seller" />
                    <Input label="Seller's Phone (optional)" value={form.collectFromPhone} onChange={v => setForm(f => ({...f, collectFromPhone: v}))} placeholder="e.g. 0712 345 678" type="tel" />
                  </div>
                  <div style={{ marginBottom: 14, padding: "12px 14px", background: "#F9FAFB", borderRadius: 10, border: "1px solid #E5E7EB" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>🏠 Deliver To Me</div>
                    <Input label="My Delivery Address" value={form.deliveryAddress} onChange={v => setForm(f => ({...f, deliveryAddress: v}))} placeholder="Your home or office address" />
                  </div>
                </>
              )}
              {!isPickup && (
                <>
                  <Input label="Pickup Address"   value={form.pickupAddress}   onChange={v => setForm(f => ({...f, pickupAddress: v}))}   placeholder="Where should we collect from?" />
                  <Input label="Delivery Address" value={form.deliveryAddress} onChange={v => setForm(f => ({...f, deliveryAddress: v}))} placeholder="Where should we deliver to?" />
                </>
              )}

              {/* Zone picker with tier grouping */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Delivery Zone</div>
                <select value={form.deliveryZone} onChange={e => setForm(f => ({...f, deliveryZone: e.target.value}))}
                  style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, fontFamily: "inherit", color: "#111827", background: "#fff", boxSizing: "border-box" }}>
                  {ZONE_GROUPS.map(group => (
                    <optgroup key={group.tier} label={`${group.label} — KES ${group.price}`}>
                      {group.zones.map(z => <option key={z} value={z}>{z}</option>)}
                    </optgroup>
                  ))}
                </select>
                {/* Tier badge */}
                {form.deliveryZone && (() => {
                  const t = TIER_BADGE[getZoneInfo(form.deliveryZone).tier];
                  return (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6, background: t.bg, color: t.color, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                      <span>●</span> {t.label}
                    </div>
                  );
                })()}
              </div>
              <Input label={isPickup ? "What should we collect?" : "Item Description"} value={form.description} onChange={v => setForm(f => ({...f, description: v}))} placeholder={isPickup ? "e.g. Dress from tailor, online order, shoes..." : "e.g. Electronics, Documents..."} />
              <Select label="Package Size"        value={form.size}            onChange={v => setForm(f => ({...f, size: v}))}            options={[{value:"small",label:"Small (under 5kg)"},{value:"medium",label:"Medium (5-15kg)"},{value:"large",label:"Large (15kg+)"}]} />
              <Input label="Declared Value (KES)" value={form.declaredValue}   onChange={v => setForm(f => ({...f, declaredValue: v}))}   type="number" placeholder="0" />
            </Card>

            {/* Fee preview */}
            <Card style={{ marginTop: 12, background: "#FEF2F2", border: "1.5px solid #FECACA" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#7F1D1D", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>Fee Breakdown</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "#6B7280", fontSize: 14 }}>Base Rate {fees.tier && <span style={{ fontSize: 11, background: TIER_BADGE[fees.tier]?.bg, color: TIER_BADGE[fees.tier]?.color, padding: "1px 7px", borderRadius: 10, fontWeight: 700, marginLeft: 6 }}>Zone {fees.tier}</span>}</span>
                <span style={{ fontWeight: 700, color: "#111827" }}>KES {fees.base}</span>
              </div>
              {fees.protectionFee > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ color: "#6B7280", fontSize: 14 }}>Delivery Protection (1.5%)</span>
                  <span style={{ fontWeight: 700, color: "#DC2626" }}>KES {fees.protectionFee}</span>
                </div>
              )}
              <div style={{ borderTop: "1px solid #FECACA", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 800, color: "#111827", fontSize: 15 }}>Total</span>
                <span style={{ fontWeight: 900, color: "#DC2626", fontSize: 20 }}>KES {fees.total}</span>
              </div>
              {fees.isHighValue && (
                <div style={{ marginTop: 10, padding: "8px 12px", background: "#FEF2F2", borderRadius: 8, fontSize: 12, color: "#DC2626", fontWeight: 600 }}>
                  ⚡ High Value Item — OTP verification required at handoff points
                </div>
              )}
            </Card>

            {/* M-Pesa preview pill */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 12, padding: "10px 14px", marginTop: 12 }}>
              <span style={{ fontSize: 20 }}>📱</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#14532D" }}>Pay via M-Pesa after booking</div>
                <div style={{ fontSize: 11, color: "#16A34A" }}>Till {MPESA_TILL} · {MPESA_NAME}</div>
              </div>
              <span style={{ fontSize: 14, fontWeight: 900, color: "#16A34A" }}>KES {fees.total}</span>
            </div>

            <Btn onClick={handleBook} style={{ width: "100%", marginTop: 16 }} size="lg" disabled={!canSubmit || submitting}>
              {submitting ? "Booking..." : isPickup ? `Request Pickup — KES ${fees.total}` : `Book & Pay — KES ${fees.total}`}
            </Btn>
          </div>
        ) : (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: "#111827", marginBottom: 16, marginTop: 0 }}>Your Deliveries</h2>
            {packages.length === 0 && (
              <Card style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#374151" }}>No deliveries yet</div>
                <div style={{ fontSize: 13, color: "#9CA3AF", marginTop: 4 }}>Book your first delivery!</div>
                <Btn onClick={() => setView("new")} style={{ marginTop: 16 }} variant="primary">Book a Delivery</Btn>
              </Card>
            )}
            {packages.map(pkg => (
              <Card key={pkg.id} style={{ marginBottom: 12, cursor: "pointer" }} onClick={() => setExpandedPkg(expandedPkg === pkg.id ? null : pkg.id)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", fontFamily: "monospace" }}>{pkg.trackingCode}</div>
                    <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>{pkg.description}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <StatusBadge status={pkg.status} />
                    {pkg.requestType === "pickup_request" && <div style={{ fontSize: 10, fontWeight: 700, color: "#7C3AED", background: "#EDE9FE", padding: "2px 8px", borderRadius: 20 }}>🛵 Pickup Req.</div>}
                    {pkg.isHighValue && <HighValueBadge />}
                  </div>
                </div>
                {pkg.requestType === "pickup_request" && pkg.collectFromName && <div style={{ fontSize: 12, color: "#7C3AED", fontWeight: 600, marginBottom: 2 }}>🏪 {pkg.collectFromName}</div>}
                <div style={{ fontSize: 12, color: "#9CA3AF" }}>→ {pkg.deliveryAddress}</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#6B7280" }}>KES {pkg.total}</span>
                  <span style={{ fontSize: 12, color: "#DC2626", fontWeight: 700 }}>{expandedPkg === pkg.id ? "▲ Less" : "▼ Details"}</span>
                </div>
                {expandedPkg === pkg.id && (
                  <div style={{ marginTop: 14, borderTop: "1px solid #F3F4F6", paddingTop: 14 }}>
                    <TrackingProgress status={pkg.status} />
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>Chain of Custody</div>
                    <Timeline logs={transitLogs.filter(l => l.packageId === pkg.id)} />
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// RIDER APP
// ============================================================
function RiderApp({ packages, onAcceptCollection, onConfirmCollection, onMarkAtWarehouse, onCollectedFromWarehouse, onAcceptDelivery, onVerifyOTP, onMarkDelivered, transitLogs, currentRider, customers = [] }) {
  const rider = currentRider || {};
  const [feed, setFeed] = useState("collection");
  const [otpInput, setOtpInput] = useState({});
  const [otpError, setOtpError] = useState({});

  const collectionFeed = packages.filter(p => p.status === "searching_rider" && !p.riderCollectionId);
  const deliveryFeed   = packages.filter(p => p.riderDeliveryId === rider.id && p.status === "at_warehouse");
  const myActive       = packages.filter(p => p.riderCollectionId === rider.id || p.riderDeliveryId === rider.id);
  const myCompleted    = myActive.filter(p => p.status === "delivered");
  const myInProgress   = myActive.filter(p => p.status !== "delivered" && !(p.riderDeliveryId === rider.id && p.status === "at_warehouse"));

  const handleOTPVerify = (pkg, type) => {
    const entered = otpInput[`${pkg.id}-${type}`] || "";
    const correct = type === "warehouse" ? pkg.otpWarehouse : pkg.otpDelivery;
    if (entered === correct) {
      onVerifyOTP(pkg.id, type);
      setOtpError(e => ({...e, [`${pkg.id}-${type}`]: false}));
    } else {
      setOtpError(e => ({...e, [`${pkg.id}-${type}`]: true}));
    }
  };

  const PkgCard = ({ pkg }) => {
    const isMyCollection = pkg.riderCollectionId === rider.id;
    const isMyDelivery   = pkg.riderDeliveryId   === rider.id;
    const needsWarehouseOTP = pkg.isHighValue && isMyCollection && pkg.status === "at_warehouse" && !pkg.otpWarehouseVerified;
    const needsDeliveryOTP  = pkg.isHighValue && isMyDelivery   && pkg.status === "out_for_delivery" && !pkg.otpDeliveryVerified;
    const [busy, setBusy] = useState(false);
    const doAction = async (fn) => { if (busy) return; setBusy(true); try { await fn(); } finally { setBusy(false); } };

    return (
      <Card style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontFamily: "monospace", fontWeight: 600, fontSize: 13, color: "#111827" }}>{pkg.trackingCode}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {pkg.requestType === "pickup_request" && <div style={{ fontSize: 10, fontWeight: 700, color: "#7C3AED", background: "#EDE9FE", padding: "2px 8px", borderRadius: 20 }}>🛵 Pickup</div>}
            <StatusBadge status={pkg.status} />
            {pkg.isHighValue && <HighValueBadge />}
          </div>
        </div>
        <div style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>{pkg.description}</div>
        <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
          {pkg.requestType === "pickup_request" && pkg.collectFromName && (
            <div style={{ fontWeight: 700, color: "#7C3AED", marginBottom: 2 }}>🏪 Collect from: {pkg.collectFromName}</div>
          )}
          {pkg.requestType === "pickup_request" && pkg.collectFromPhone && (
            <div style={{ color: "#7C3AED", marginBottom: 2 }}>📞 Seller: {pkg.collectFromPhone}</div>
          )}
          📍 {pkg.pickupAddress}<br/>
          🏠 → {pkg.deliveryAddress}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12, color: "#9CA3AF" }}>
          <span>Zone: <strong style={{ color: "#374151" }}>{pkg.deliveryZone}</strong></span>
          <span>KES {pkg.declaredValue.toLocaleString()} value</span>
        </div>
        {/* Sender contact for collection rider */}
        {isMyCollection && !isMyDelivery && pkg.status !== "searching_rider" && (() => {
          const sender = customers.find(cu => cu.id === pkg.customerId);
          return sender ? (
            <div style={{ marginTop: 10, background: "#EFF6FF", border: "1.5px solid #BFDBFE", borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#1D4ED8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>📬 Sender Contact</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#111827" }}>{sender.name}</div>
                  <div style={{ fontSize: 12, color: "#6B7280", marginTop: 1 }}>{sender.phone}</div>
                </div>
                <a href={`tel:${sender.phone}`} style={{ background: "#2563EB", color: "#fff", padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: "none", flexShrink: 0 }}>📞 Call</a>
              </div>
            </div>
          ) : null;
        })()}
        {/* Recipient contact for delivery rider */}
        {isMyDelivery && (
          <div style={{ marginTop: 10, background: "#F0FDF4", border: "1.5px solid #6EE7B7", borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#065F46", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>🏠 Recipient Contact</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#111827" }}>{pkg.recipientName || "(name not provided)"}</div>
                <div style={{ fontSize: 12, color: "#6B7280", marginTop: 1 }}>{pkg.recipientPhone || pkg.deliveryAddress}</div>
              </div>
              {pkg.recipientPhone && (
                <a href={`tel:${pkg.recipientPhone}`} style={{ background: "#10B981", color: "#fff", padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: "none", flexShrink: 0 }}>📞 Call</a>
              )}
            </div>
          </div>
        )}
        {/* Actions */}
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {pkg.status === "searching_rider" && !isMyCollection && (
            <Btn onClick={() => doAction(() => onAcceptCollection(pkg.id, rider.id))} variant="primary" disabled={busy}>{busy ? "Accepting…" : "✅ Accept Order"}</Btn>
          )}
          {pkg.status === "awaiting_collection" && isMyCollection && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ background: "#E0F2FE", border: "1.5px solid #BAE6FD", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#0369A1" }}>🏍️ Heading to sender — collect the package</div>
                <div style={{ fontSize: 12, color: "#0284C7", marginTop: 2 }}>Once you physically have it, tap confirm below.</div>
              </div>
              <Btn onClick={() => doAction(() => onConfirmCollection(pkg.id))} variant="success" disabled={busy}>{busy ? "Confirming…" : "📦 Confirm Collection"}</Btn>
            </div>
          )}
          {pkg.status === "picked_up" && isMyCollection && (
            <Btn onClick={() => doAction(() => onMarkAtWarehouse(pkg.id))} variant="success" disabled={busy}>{busy ? "Saving…" : "🏭 Arrived at Warehouse"}</Btn>
          )}
          {pkg.status === "pending_warehouse" && isMyCollection && (
            <div style={{ background: "#EEF2FF", border: "1.5px solid #C7D2FE", borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#3730A3" }}>⏳ Waiting for warehouse acceptance</div>
              <div style={{ fontSize: 12, color: "#4338CA", marginTop: 2 }}>The admin will confirm receipt of the package.</div>
            </div>
          )}
          {pkg.status === "at_warehouse" && isMyCollection && !isMyDelivery && (
            <div style={{ background: "#F0FDF4", border: "1.5px solid #6EE7B7", borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#065F46" }}>✅ Accepted at warehouse</div>
              <div style={{ fontSize: 12, color: "#047857", marginTop: 2 }}>Awaiting dispatch to delivery rider.</div>
            </div>
          )}
          {needsWarehouseOTP && (
            <div style={{ background: "#FEF2F2", border: "1.5px solid #FCA5A5", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#7F1D1D", marginBottom: 8 }}>🔐 Enter Warehouse Manager OTP</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input maxLength={4} value={otpInput[`${pkg.id}-warehouse`] || ""} onChange={e => setOtpInput(o => ({...o, [`${pkg.id}-warehouse`]: e.target.value}))}
                  placeholder="- - - -" style={{ flex: 1, padding: "8px 12px", border: `1.5px solid ${otpError[`${pkg.id}-warehouse`] ? "#EF4444" : "#E5E7EB"}`, borderRadius: 8, fontSize: 18, textAlign: "center", letterSpacing: 6, fontFamily: "monospace" }} />
                <Btn onClick={() => handleOTPVerify(pkg, "warehouse")} variant="purple" size="sm">Verify</Btn>
              </div>
              {otpError[`${pkg.id}-warehouse`] && <div style={{ color: "#EF4444", fontSize: 12, marginTop: 6 }}>❌ Incorrect OTP. Try again.</div>}
            </div>
          )}
          {pkg.status === "at_warehouse" && isMyDelivery && (
            <Btn onClick={() => doAction(() => onAcceptDelivery(pkg.id))} variant="primary" disabled={busy}>{busy ? "Accepting…" : "✅ Accept Delivery Job"}</Btn>
          )}
          {pkg.status === "out_for_delivery" && isMyDelivery && (
            needsDeliveryOTP ? (
              <div style={{ background: "#FEF2F2", border: "1.5px solid #FCA5A5", borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#7F1D1D", marginBottom: 8 }}>🔐 Customer OTP Verification</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input maxLength={4} value={otpInput[`${pkg.id}-delivery`] || ""} onChange={e => setOtpInput(o => ({...o, [`${pkg.id}-delivery`]: e.target.value}))}
                    placeholder="- - - -" style={{ flex: 1, padding: "8px 12px", border: `1.5px solid ${otpError[`${pkg.id}-delivery`] ? "#EF4444" : "#E5E7EB"}`, borderRadius: 8, fontSize: 18, textAlign: "center", letterSpacing: 6, fontFamily: "monospace" }} />
                  <Btn onClick={() => handleOTPVerify(pkg, "delivery")} variant="purple" size="sm">Verify</Btn>
                </div>
                {otpError[`${pkg.id}-delivery`] && <div style={{ color: "#EF4444", fontSize: 12, marginTop: 6 }}>❌ Incorrect OTP. Try again.</div>}
              </div>
            ) : (
              <Btn onClick={() => doAction(() => onMarkDelivered(pkg.id))} variant="success" disabled={busy}>{busy ? "Saving…" : "🎉 Mark as Delivered"}</Btn>
            )
          )}
          {pkg.status === "pending_delivery" && isMyDelivery && (
            <div style={{ background: "#FFF7ED", border: "1.5px solid #FED7AA", borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#9A3412" }}>📬 Delivery reported</div>
              <div style={{ fontSize: 12, color: "#C2410C", marginTop: 2 }}>Waiting for admin to confirm delivery.</div>
            </div>
          )}
          {pkg.status === "delivered" && (
            <div style={{ background: "#ECFDF5", border: "1.5px solid #6EE7B7", borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#065F46" }}>🎉 Delivered & Confirmed</div>
              <div style={{ fontSize: 12, color: "#047857", marginTop: 2 }}>This delivery is complete.</div>
            </div>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div style={{ background: "#1F2937", padding: "20px 20px 0", borderRadius: "0 0 24px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 600, color: "#fff" }}>Baruk Rider</div>
            <div style={{ fontSize: 13, color: "#9CA3AF" }}>👋 {rider.name}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ background: "#DC2626", color: "#fff", padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>📍 {rider.zone}</div>
            <div style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>{rider.phone}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 2, marginTop: 16 }}>
          {[
            ["collection", "📦 Collect",  collectionFeed.length],
            ["delivery",   "🚀 Deliver",  deliveryFeed.length],
            ["active",     "⚡ Active",   myInProgress.length],
            ["done",       "✅ Done",     myCompleted.length],
          ].map(([v, l, count]) => (
            <button key={v} onClick={() => setFeed(v)} style={{ flex: 1, padding: "8px 2px", border: "none", background: feed === v ? "#fff" : "transparent", color: feed === v ? "#1F2937" : "rgba(255,255,255,0.6)", fontWeight: 700, borderRadius: "8px 8px 0 0", cursor: "pointer", fontSize: 10, fontFamily: "inherit", position: "relative" }}>
              {l}
              {count > 0 && <span style={{ position: "absolute", top: 4, right: 6, background: feed === v ? "#DC2626" : "rgba(220,38,38,0.8)", color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>{count}</span>}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: "16px" }}>
        {feed === "collection" && (
          <div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 12 }}>Open collection jobs — accept one to pick up from customer:</div>
            {collectionFeed.length === 0
              ? <Card style={{ textAlign: "center", padding: "32px 20px", color: "#9CA3AF" }}><div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>No collection jobs right now</Card>
              : collectionFeed.map(p => <PkgCard key={p.id} pkg={p} />)}
          </div>
        )}
        {feed === "delivery" && (
          <div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 12 }}>Packages dispatched to you — collect from hub and deliver:</div>
            {deliveryFeed.length === 0
              ? <Card style={{ textAlign: "center", padding: "32px 20px", color: "#9CA3AF" }}><div style={{ fontSize: 32, marginBottom: 8 }}>🏭</div>No deliveries assigned to you yet</Card>
              : deliveryFeed.map(p => <PkgCard key={p.id} pkg={p} />)}
          </div>
        )}
        {feed === "active" && (
          <div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 12 }}>Your packages currently in progress:</div>
            {myInProgress.length === 0
              ? <Card style={{ textAlign: "center", padding: "32px 20px", color: "#9CA3AF" }}><div style={{ fontSize: 32, marginBottom: 8 }}>✨</div>Nothing active right now</Card>
              : myInProgress.map(p => <PkgCard key={p.id} pkg={p} />)}
          </div>
        )}
        {feed === "done" && (
          <div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 12 }}>Completed deliveries:</div>
            {myCompleted.length === 0
              ? <Card style={{ textAlign: "center", padding: "32px 20px", color: "#9CA3AF" }}><div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>No completed deliveries yet</Card>
              : myCompleted.map(p => <PkgCard key={p.id} pkg={p} />)}
          </div>
        )}
      </div>
    </div>
  );
}


// ── Stateful admin action buttons ──
const AcceptWarehouseBtn = ({ pkgId, onAcceptAtWarehouse }) => {
  const [busy, setBusy] = useState(false);
  const handle = async () => { setBusy(true); try { await onAcceptAtWarehouse(pkgId); } finally { setBusy(false); } };
  return (
    <Btn onClick={handle} variant="success" disabled={busy} style={{ width: "100%" }}>
      {busy ? "⏳ Accepting…" : "✅ Condition Verified — Accept Package"}
    </Btn>
  );
};

const ConfirmDeliveryBtn = ({ pkgId, onConfirmDelivery }) => {
  const [busy, setBusy] = useState(false);
  const handle = async () => { setBusy(true); try { await onConfirmDelivery(pkgId); } finally { setBusy(false); } };
  return (
    <Btn onClick={handle} variant="success" disabled={busy} style={{ width: "100%" }}>
      {busy ? "⏳ Confirming…" : "✅ Confirm Delivery Complete"}
    </Btn>
  );
};

// ============================================================
// ADMIN DASHBOARD
// ============================================================
function AdminDashboard({ packages, riders, customers, transitLogs, onDispatch, onAcceptAtWarehouse, onConfirmDelivery, onAddRider, accounts, onRefresh }) {
  const [view, setView] = useState("hub");
  useEffect(() => { if (onRefresh) onRefresh(); }, []);
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [selectedRider, setSelectedRider] = useState("");
  const [showAddRider, setShowAddRider] = useState(false);
  const [riderForm, setRiderForm] = useState({});
  const [riderFormError, setRiderFormError] = useState("");
  const [riderFormSuccess, setRiderFormSuccess] = useState("");

  const handleAddRider = () => {
    setRiderFormError(""); setRiderFormSuccess("");
    const { name, email, phone, password, licenseNumber, zone } = riderForm;
    if (!name || !email || !phone || !password || !licenseNumber || !zone)
      return setRiderFormError("Please fill in all fields.");
    if (accounts.find(a => a.email === email.trim().toLowerCase()))
      return setRiderFormError("An account with this email already exists.");
    const newRider = {
      id: `rider-${Date.now()}`, role: "rider",
      name: name.trim(), email: email.trim().toLowerCase(),
      phone: phone.trim(), password, licenseNumber: licenseNumber.trim(),
      zone: zone || ZONES[0],
    };
    onAddRider(newRider);
    setRiderFormSuccess(`Rider account created for ${name}. They can now log in with ${email}.`);
    setRiderForm({});
    setTimeout(() => { setShowAddRider(false); setRiderFormSuccess(""); }, 3000);
  };
  const [otpInput, setOtpInput] = useState("");
  const [otpError, setOtpError] = useState(false);

  const pendingAcceptance = packages.filter(p => p.status === "pending_warehouse");
  const atHubUnassigned   = packages.filter(p => p.status === "at_warehouse" && !p.riderDeliveryId);
  const atHubDispatched   = packages.filter(p => p.status === "at_warehouse" && p.riderDeliveryId);
  const atHub             = packages.filter(p => p.status === "at_warehouse");
  const pendingDelivery   = packages.filter(p => p.status === "pending_delivery");
  const newRequests       = packages.filter(p => p.status === "searching_rider");
  const inTransit = packages.filter(p => ["searching_rider","awaiting_collection","picked_up","pending_warehouse","at_warehouse","out_for_delivery","pending_delivery"].includes(p.status));
  const delivered = packages.filter(p => p.status === "delivered");
  const totalFees = packages.reduce((s, p) => s + p.total, 0);
  const totalValue = inTransit.reduce((s, p) => s + p.declaredValue, 0);

  const [dispatching, setDispatching] = useState(false);
  const handleDispatch = async (pkg) => {
    if (!selectedRider || dispatching) return;
    setDispatching(true);
    try {
      await onDispatch(pkg.id, selectedRider);
      setSelectedPkg(null);
      setSelectedRider("");
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", background: "#F8FAFC", minHeight: "100vh" }}>
      {/* Topbar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E5E7EB", padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🏭</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#111827" }}>Baruk Admin</div>
            <div style={{ fontSize: 11, color: "#9CA3AF" }}>Central Warehouse Operations</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            ["hub",       "📦 Hub",        pendingAcceptance.length + pendingDelivery.length],
            ["requests",  "📋 Requests",   newRequests.length],
            ["riders",    "🏍️ Riders",     0],
            ["customers", "👥 Customers",  0],
            ["logs",      "📋 Custody",    0],
            ["revenue",   "💰 Revenue",    0],
            ["debug",     "🔧 Debug",      0],
          ].map(([v, l, badge]) => (
            <button key={v} onClick={() => setView(v)} style={{ padding: "6px 14px", border: "none", background: view === v ? "#DC2626" : "#F3F4F6", color: view === v ? "#fff" : "#6B7280", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "inherit", position: "relative" }}>
              {l}
              {badge > 0 && <span style={{ position: "absolute", top: -4, right: -4, background: "#F59E0B", color: "#fff", borderRadius: "50%", width: 18, height: 18, fontSize: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>{badge}</span>}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: 24 }}>
        {/* Stats Bar — 8 clickable tiles */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 10, marginBottom: 24 }}>
          {[
            { label: "Pending Accept",    value: pendingAcceptance.length, sub: "need action",      color: "#F59E0B", tab: "hub",       urgent: pendingAcceptance.length > 0 },
            { label: "At Hub",            value: atHub.length,             sub: "ready to dispatch", color: "#6366F1", tab: "hub",       urgent: false },
            { label: "In Transit",        value: inTransit.length,         sub: "packages",          color: "#EF4444", tab: "hub",       urgent: false },
            { label: "New Requests",      value: newRequests.length,       sub: "incoming",          color: "#0EA5E9", tab: "requests",  urgent: newRequests.length > 0 },
            { label: "Pending Delivery",  value: pendingDelivery.length,   sub: "to confirm",        color: "#F97316", tab: "hub",       urgent: pendingDelivery.length > 0 },
            { label: "Delivered",         value: delivered.length,         sub: "packages",          color: "#10B981", tab: "logs",      urgent: false },
            { label: "Customers",         value: customers.length,         sub: "registered",        color: "#7C3AED", tab: "customers", urgent: false },
            { label: "Revenue",           value: `KES ${totalFees.toLocaleString()}`, sub: "collected", color: "#DC2626", tab: "revenue", urgent: false },
          ].map(s => (
            <div key={s.label} onClick={() => setView(s.tab)} style={{ cursor: "pointer" }}>
              <Card style={{ textAlign: "center", border: s.urgent ? `2px solid ${s.color}` : "none", boxShadow: s.urgent ? `0 0 0 3px ${s.color}22` : undefined }}>
                <Stat {...s} />
                {s.urgent && <div style={{ fontSize: 9, fontWeight: 800, color: s.color, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 4 }}>● ACTION NEEDED</div>}
              </Card>
            </div>
          ))}
        </div>

        {view === "hub" && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "#111827", marginBottom: 16 }}>Hub Inventory — {atHub.length} Packages</div>
            {/* ── SECTION 1: Pending Warehouse Acceptance ── */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: pendingAcceptance.length > 0 ? "#F59E0B" : "#D1D5DB", boxShadow: pendingAcceptance.length > 0 ? "0 0 0 3px rgba(245,158,11,0.2)" : "none" }} />
                <div style={{ fontSize: 16, fontWeight: 800, color: pendingAcceptance.length > 0 ? "#92400E" : "#6B7280" }}>Awaiting Warehouse Acceptance — {pendingAcceptance.length} Package{pendingAcceptance.length !== 1 ? "s" : ""}</div>
                {pendingAcceptance.length > 0 && <span style={{ background: "#FEF3C7", color: "#92400E", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>ACTION REQUIRED</span>}
              </div>
              {pendingAcceptance.length === 0 ? (
                <Card style={{ textAlign: "center", padding: "20px", background: "#F9FAFB", border: "1px dashed #E5E7EB" }}>
                  <div style={{ fontSize: 13, color: "#9CA3AF" }}>✅ No packages awaiting warehouse acceptance right now</div>
                </Card>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 14 }}>
                  {pendingAcceptance.map(pkg => {
                    const collectionRider = riders.find(r => r.id === pkg.riderCollectionId);
                    return (
                      <Card key={pkg.id} style={{ border: "2px solid #FDE68A", background: "#FFFBEB" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                          <div>
                            <div style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 15, color: "#111827" }}>{pkg.trackingCode}</div>
                            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>Rider arrived — physical inspection required</div>
                          </div>
                          <StatusBadge status={pkg.status} />
                        </div>
                        <div style={{ background: "#FEF9C3", border: "1px solid #FDE68A", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 12, color: "#713F12", fontWeight: 700 }}>
                          ⚠️ Verify the following before accepting:
                        </div>
                        <div style={{ background: "#fff", borderRadius: 10, padding: "12px 14px", marginBottom: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                          {[
                            ["Description",      pkg.description],
                            ["Size",             pkg.size],
                            ["Declared Value",   `KES ${pkg.declaredValue?.toLocaleString()}`],
                            ["Customer",         pkg.customerName],
                            ["Pickup from",      pkg.pickupAddress],
                            ["Delivering to",    pkg.deliveryAddress],
                          ].map(([label, val]) => (
                            <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                              <span style={{ color: "#6B7280", fontWeight: 600 }}>{label}</span>
                              <span style={{ fontWeight: 700, color: "#111827", textAlign: "right", maxWidth: 200 }}>{val}</span>
                            </div>
                          ))}
                          <div style={{ height: 1, background: "#F3F4F6" }} />
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                            <span style={{ color: "#6B7280", fontWeight: 600 }}>Destination Zone</span>
                            {(() => { const t = TIER_BADGE[getZoneInfo(pkg.deliveryZone).tier]; return <span style={{ background: t.bg, color: t.color, padding: "2px 8px", borderRadius: 12, fontSize: 12, fontWeight: 700 }}>{pkg.deliveryZone}</span>; })()}
                          </div>
                          <div style={{ height: 1, background: "#F3F4F6" }} />
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                            <span style={{ color: "#6B7280", fontWeight: 600 }}>Brought by rider</span>
                            <span style={{ fontWeight: 800, color: "#DC2626" }}>🏍️ {collectionRider?.name || "Unknown"}</span>
                          </div>
                          {collectionRider?.phone && (
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                              <span style={{ color: "#6B7280", fontWeight: 600 }}>Rider phone</span>
                              <a href={`tel:${collectionRider.phone}`} style={{ fontWeight: 700, color: "#0EA5E9", textDecoration: "none" }}>{collectionRider.phone}</a>
                            </div>
                          )}
                        </div>
                        {(pkg.isHighValue || pkg.protectionFee > 0) && (
                          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                            {pkg.isHighValue && <HighValueBadge />}
                            {pkg.protectionFee > 0 && <span style={{ background: "#FEF3C7", color: "#92400E", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>🛡️ INSURED — KES {pkg.protectionFee}</span>}
                          </div>
                        )}
                        <AcceptWarehouseBtn pkgId={pkg.id} onAcceptAtWarehouse={onAcceptAtWarehouse} />
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── SECTION 2: Pending Delivery Confirmation ── */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: pendingDelivery.length > 0 ? "#F97316" : "#D1D5DB", boxShadow: pendingDelivery.length > 0 ? "0 0 0 3px rgba(249,115,22,0.2)" : "none" }} />
                <div style={{ fontSize: 16, fontWeight: 800, color: pendingDelivery.length > 0 ? "#9A3412" : "#6B7280" }}>Pending Delivery Confirmation — {pendingDelivery.length} Package{pendingDelivery.length !== 1 ? "s" : ""}</div>
                {pendingDelivery.length > 0 && <span style={{ background: "#FFF7ED", color: "#9A3412", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>ACTION REQUIRED</span>}
              </div>
              {pendingDelivery.length === 0 ? (
                <Card style={{ textAlign: "center", padding: "20px", background: "#F9FAFB", border: "1px dashed #E5E7EB" }}>
                  <div style={{ fontSize: 13, color: "#9CA3AF" }}>✅ No deliveries pending confirmation right now</div>
                </Card>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
                  {pendingDelivery.map(pkg => {
                    const deliveryRider = riders.find(r => r.id === pkg.riderDeliveryId);
                    const reportedLog = [...transitLogs].reverse().find(l => l.packageId === pkg.id && l.event === "DELIVERY_REPORTED");
                    return (
                      <Card key={pkg.id} style={{ border: "2px solid #FED7AA", background: "#FFF7ED" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                          <div>
                            <div style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 15, color: "#111827" }}>{pkg.trackingCode}</div>
                            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>Rider reported delivery — confirm to close</div>
                          </div>
                          <StatusBadge status={pkg.status} />
                        </div>
                        <div style={{ background: "#fff", borderRadius: 10, padding: "12px 14px", marginBottom: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                          {[
                            ["Description",    pkg.description],
                            ["Customer",       pkg.customerName],
                            ["Delivered to",   pkg.deliveryAddress],
                            ["Declared value", `KES ${pkg.declaredValue?.toLocaleString()}`],
                          ].map(([label, val]) => (
                            <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                              <span style={{ color: "#6B7280", fontWeight: 600 }}>{label}</span>
                              <span style={{ fontWeight: 700, color: "#111827", textAlign: "right", maxWidth: 200 }}>{val}</span>
                            </div>
                          ))}
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                            <span style={{ color: "#6B7280", fontWeight: 600 }}>Delivery rider</span>
                            <span style={{ fontWeight: 800, color: "#DC2626" }}>🏍️ {deliveryRider?.name || "Unknown"}</span>
                          </div>
                          {deliveryRider?.phone && (
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                              <span style={{ color: "#6B7280", fontWeight: 600 }}>Rider phone</span>
                              <a href={`tel:${deliveryRider.phone}`} style={{ fontWeight: 700, color: "#0EA5E9", textDecoration: "none" }}>{deliveryRider.phone}</a>
                            </div>
                          )}
                          {reportedLog && (
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                              <span style={{ color: "#6B7280", fontWeight: 600 }}>Reported at</span>
                              <span style={{ fontWeight: 600, color: "#374151" }}>{new Date(reportedLog.createdAt).toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                        {pkg.isHighValue && <div style={{ marginBottom: 10 }}><HighValueBadge /></div>}
                        <ConfirmDeliveryBtn pkgId={pkg.id} onConfirmDelivery={onConfirmDelivery} />
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── SECTION 3: Ready to Dispatch ── */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#6366F1" }} />
                <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>Ready to Dispatch — {atHubUnassigned.length} Package{atHubUnassigned.length !== 1 ? "s" : ""}</div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                  <thead>
                    <tr style={{ background: "#F9FAFB" }}>
                      {["Tracking","Description","Customer","Pickup","Drop-off Zone","Value","Flags","Assign Rider"].map(h => (
                        <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {atHubUnassigned.map((pkg, i) => (
                      <tr key={pkg.id} style={{ borderBottom: i < atHubUnassigned.length - 1 ? "1px solid #F3F4F6" : "none", background: selectedPkg?.id === pkg.id ? "#FEF2F2" : "#fff" }}>
                        <td style={{ padding: "12px 16px", fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: "#111827" }}>{pkg.trackingCode}</td>
                        <td style={{ padding: "12px 16px", fontSize: 13, color: "#374151" }}>{pkg.description}</td>
                        <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: "#111827" }}>{pkg.customerName}</td>
                        <td style={{ padding: "12px 16px", fontSize: 12, color: "#6B7280", maxWidth: 140 }}>{pkg.pickupAddress}</td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ marginBottom: 4 }}>{(() => { const t = TIER_BADGE[getZoneInfo(pkg.deliveryZone).tier]; return <span style={{ background: t.bg, color: t.color, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{pkg.deliveryZone}</span>; })()}</div>
                          <div style={{ fontSize: 11, color: "#9CA3AF" }}>{pkg.deliveryAddress}</div>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: "#111827" }}>KES {pkg.declaredValue?.toLocaleString()}</td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {pkg.isHighValue && <HighValueBadge />}
                            {pkg.protectionFee > 0 && <span style={{ fontSize: 10, background: "#FEF3C7", color: "#7F1D1D", padding: "2px 6px", borderRadius: 10, fontWeight: 700 }}>PROTECTED</span>}
                            {pkg.requestType === "pickup_request" && <span style={{ fontSize: 10, background: "#EDE9FE", color: "#7C3AED", padding: "2px 6px", borderRadius: 10, fontWeight: 700 }}>🛵 PICKUP</span>}
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          {selectedPkg?.id === pkg.id ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 180 }}>
                              <select value={selectedRider} onChange={e => setSelectedRider(e.target.value)} style={{ padding: "6px 10px", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 13, fontFamily: "inherit" }}>
                                <option value="">Select Rider...</option>
                                {riders.filter(r => r.zone === pkg.deliveryZone).length > 0
                                  ? riders.filter(r => r.zone === pkg.deliveryZone).map(r => <option key={r.id} value={r.id}>{r.name} — {r.zone}</option>)
                                  : riders.map(r => <option key={r.id} value={r.id}>{r.name} ({r.zone})</option>)}
                              </select>
                              <div style={{ display: "flex", gap: 6 }}>
                                <Btn onClick={() => handleDispatch(pkg)} variant="success" size="sm" disabled={!selectedRider || dispatching}>{dispatching ? "Saving…" : "🚀 Dispatch"}</Btn>
                                <Btn onClick={() => { setSelectedPkg(null); setSelectedRider(""); }} variant="ghost" size="sm">Cancel</Btn>
                              </div>
                            </div>
                          ) : (
                            <Btn onClick={() => { setSelectedPkg(pkg); setSelectedRider(""); }} variant="primary" size="sm">Assign Rider →</Btn>
                          )}
                        </td>
                      </tr>
                    ))}
                    {atHubUnassigned.length === 0 && (
                      <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "#9CA3AF" }}>All hub packages have been assigned</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── SECTION 4: Dispatched — Awaiting Rider Collection ── */}
            {atHubDispatched.length > 0 && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#0EA5E9" }} />
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>Dispatched — Awaiting Rider Collection ({atHubDispatched.length})</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                  {atHubDispatched.map(pkg => {
                    const deliveryRider = riders.find(r => r.id === pkg.riderDeliveryId);
                    return (
                      <Card key={pkg.id} style={{ border: "1.5px solid #BAE6FD", background: "#F0F9FF" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                          <div style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 13, color: "#111827" }}>{pkg.trackingCode}</div>
                          <StatusBadge status={pkg.status} />
                        </div>
                        <div style={{ fontSize: 13, color: "#374151", marginBottom: 6 }}>{pkg.description}</div>
                        <div style={{ fontSize: 12, color: "#6B7280" }}>→ {pkg.deliveryAddress}</div>
                        <div style={{ marginTop: 8, padding: "8px 10px", background: "#fff", borderRadius: 8, fontSize: 12 }}>
                          <span style={{ color: "#6B7280" }}>Rider: </span>
                          <span style={{ fontWeight: 700, color: "#0EA5E9" }}>🏍️ {deliveryRider?.name || "—"}</span>
                          <span style={{ color: "#9CA3AF", marginLeft: 8 }}>({deliveryRider?.phone || ""})</span>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}


        {view === "riders" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#111827" }}>Riders ({riders.length})</div>
              <Btn onClick={() => setShowAddRider(s => !s)} variant={showAddRider ? "ghost" : "primary"} size="sm">
                {showAddRider ? "✕ Cancel" : "+ Add Rider"}
              </Btn>
            </div>

            {/* Add Rider Form */}
            {showAddRider && (
              <Card style={{ marginBottom: 20, border: "1.5px solid #FECACA", background: "#FFF8F8" }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: "#111827", marginBottom: 16 }}>🏍️ Create Rider Account</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {[
                    { label: "Full Name",       key: "name",          placeholder: "e.g. John Kamau",        type: "text"     },
                    { label: "Email",            key: "email",         placeholder: "rider@baruk.co",         type: "email"    },
                    { label: "Phone Number",     key: "phone",         placeholder: "e.g. 0712 345 678",      type: "tel"      },
                    { label: "ID / License No.", key: "licenseNumber", placeholder: "e.g. DL-2024-001",       type: "text"     },
                    { label: "Password",         key: "password",      placeholder: "Set a login password",   type: "password" },
                  ].map(f => (
                    <div key={f.key} style={{ gridColumn: f.key === "name" ? "1 / -1" : undefined }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>{f.label}</div>
                      <input
                        type={f.type} value={riderForm[f.key] || ""} placeholder={f.placeholder}
                        onChange={e => setRiderForm(rf => ({ ...rf, [f.key]: e.target.value }))}
                        style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none", color: "#111827" }}
                        onFocus={e => e.target.style.borderColor = "#DC2626"}
                        onBlur={e => e.target.style.borderColor = "#E5E7EB"}
                      />
                    </div>
                  ))}
                  {/* Zone selector */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Home Zone</div>
                    <select value={riderForm.zone || ZONES[0]} onChange={e => setRiderForm(rf => ({ ...rf, zone: e.target.value }))}
                      style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, fontFamily: "inherit", color: "#111827" }}>
                      {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                    </select>
                  </div>
                </div>
                {riderFormError && (
                  <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#DC2626", fontWeight: 600, marginTop: 12 }}>
                    ⚠️ {riderFormError}
                  </div>
                )}
                {riderFormSuccess && (
                  <div style={{ background: "#ECFDF5", border: "1px solid #6EE7B7", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#065F46", fontWeight: 600, marginTop: 12 }}>
                    ✅ {riderFormSuccess}
                  </div>
                )}
                <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
                  <Btn onClick={handleAddRider} variant="primary">Create Rider Account</Btn>
                  <Btn onClick={() => { setShowAddRider(false); setRiderForm({}); setRiderFormError(""); setRiderFormSuccess(""); }} variant="ghost">Cancel</Btn>
                </div>
              </Card>
            )}

            {/* Rider cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
              {riders.map(rider => {
                const myPkgs = packages.filter(p => p.riderCollectionId === rider.id || p.riderDeliveryId === rider.id);
                const active = myPkgs.filter(p => p.status !== "delivered");
                return (
                  <Card key={rider.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 800, color: "#111827", fontSize: 15 }}>{rider.name}</div>
                        <div style={{ fontSize: 12, color: "#6B7280" }}>{rider.phone}</div>
                        {rider.licenseNumber && <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>🪪 {rider.licenseNumber}</div>}
                      </div>
                      <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#FEF2F2", border: "1.5px solid #FECACA", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🏍️</div>
                    </div>
                    <div style={{ background: "#F9FAFB", borderRadius: 10, padding: "10px 12px", marginBottom: 10 }}>
                      <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Home Zone</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#DC2626", marginTop: 2 }}>📍 {rider.zone}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <div style={{ flex: 1, textAlign: "center", background: "#FEF2F2", borderRadius: 8, padding: "8px 4px" }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: "#EF4444" }}>{active.length}</div>
                        <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 700 }}>ACTIVE</div>
                      </div>
                      <div style={{ flex: 1, textAlign: "center", background: "#ECFDF5", borderRadius: 8, padding: "8px 4px" }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: "#10B981" }}>{myPkgs.filter(p => p.status === "delivered").length}</div>
                        <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 700 }}>DONE</div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
                {view === "requests" && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#111827" }}>Incoming Requests</div>
              <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>All orders — review customer, pickup, destination and assign riders accordingly</div>
            </div>
            {packages.length === 0 ? (
              <Card style={{ textAlign: "center", padding: 48 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>No requests yet</div>
              </Card>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[...packages].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(pkg => {
                  const collRider = riders.find(r => r.id === pkg.riderCollectionId);
                  const delRider  = riders.find(r => r.id === pkg.riderDeliveryId);
                  const tier      = TIER_BADGE[getZoneInfo(pkg.deliveryZone).tier];
                  return (
                    <Card key={pkg.id} style={{ border: "1px solid #F3F4F6" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "0 0 auto" }}>
                          <div>
                            <div style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 15, color: "#DC2626" }}>{pkg.trackingCode}</div>
                            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{new Date(pkg.createdAt).toLocaleString()}</div>
                          </div>
                          <StatusBadge status={pkg.status} />
                          {pkg.isHighValue && <HighValueBadge />}
                          {pkg.requestType === "pickup_request" && <span style={{ fontSize: 11, background: "#EDE9FE", color: "#7C3AED", padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>🛵 Pickup Req.</span>}
                        </div>
                        <div style={{ textAlign: "right", flex: "0 0 auto" }}>
                          <div style={{ fontSize: 18, fontWeight: 900, color: "#DC2626" }}>KES {pkg.total}</div>
                          {pkg.protectionFee > 0 && <div style={{ fontSize: 11, color: "#9CA3AF" }}>incl. KES {pkg.protectionFee} protection</div>}
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 14 }}>
                        <div style={{ background: "#F9FAFB", borderRadius: 10, padding: "10px 12px" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Customer</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>{pkg.customerName}</div>
                          {(() => { const cust = customers.find(cu => cu.id === pkg.customerId); return cust ? <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}><div>{cust.phone}</div><div style={{ fontSize: 11, color: "#9CA3AF" }}>{cust.email}</div></div> : null; })()}
                        </div>
                        <div style={{ background: "#F9FAFB", borderRadius: 10, padding: "10px 12px" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Route</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                              <span style={{ fontSize: 12 }}>📍</span>
                              <div><div style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", textTransform: "uppercase" }}>From</div><div style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>{pkg.pickupAddress}</div></div>
                            </div>
                            <div style={{ height: 1, background: "#E5E7EB" }} />
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                              <span style={{ fontSize: 12 }}>🏠</span>
                              <div><div style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", textTransform: "uppercase" }}>To</div><div style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>{pkg.deliveryAddress}</div></div>
                            </div>
                          </div>
                        </div>
                        <div style={{ background: "#F9FAFB", borderRadius: 10, padding: "10px 12px" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Assignment</div>
                          <div style={{ marginBottom: 6 }}><span style={{ background: tier.bg, color: tier.color, padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{pkg.deliveryZone}</span></div>
                          <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}><span style={{ fontWeight: 700, color: "#374151" }}>Collection: </span>{collRider ? <span style={{ color: "#DC2626", fontWeight: 700 }}>🏍️ {collRider.name}</span> : <span style={{ color: "#9CA3AF" }}>Unassigned</span>}</div>
                          <div style={{ fontSize: 12, color: "#6B7280", marginTop: 3 }}><span style={{ fontWeight: 700, color: "#374151" }}>Delivery: </span>{delRider ? <span style={{ color: "#10B981", fontWeight: 700 }}>🏍️ {delRider.name}</span> : <span style={{ color: "#9CA3AF" }}>Unassigned</span>}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 12, marginTop: 12, paddingTop: 12, borderTop: "1px solid #F3F4F6", flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, color: "#6B7280" }}>📦 <strong style={{ color: "#374151" }}>{pkg.description}</strong></span>
                        <span style={{ fontSize: 12, color: "#6B7280" }}>Size: <strong style={{ color: "#374151", textTransform: "capitalize" }}>{pkg.size}</strong></span>
                        <span style={{ fontSize: 12, color: "#6B7280" }}>Value: <strong style={{ color: "#374151" }}>KES {pkg.declaredValue?.toLocaleString()}</strong></span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {view === "customers" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#111827" }}>Customer Profiles</div>
                <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>{customers.length} registered customers</div>
              </div>
            </div>
            {customers.length === 0 ? (
              <Card style={{ textAlign: "center", padding: 48 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 6 }}>No customers yet</div>
                <div style={{ fontSize: 13, color: "#9CA3AF" }}>Customer accounts will appear here once they sign up.</div>
              </Card>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                {customers.map(customer => {
                  const custPkgs      = packages.filter(p => p.customerId === customer.id);
                  const activePkgs    = custPkgs.filter(p => !["delivered","cancelled"].includes(p.status));
                  const deliveredPkgs = custPkgs.filter(p => p.status === "delivered");
                  const totalSpend    = custPkgs.reduce((s, p) => s + p.total, 0);
                  const joinDate      = customer.createdAt ? new Date(customer.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : "—";
                  return (
                    <Card key={customer.id} style={{ border: "1px solid #F3F4F6" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "linear-gradient(135deg, #DC2626, #EF4444)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0, boxShadow: "0 4px 12px rgba(220,38,38,0.25)", color: "#fff", fontWeight: 800 }}>
                          {customer.name ? customer.name.charAt(0).toUpperCase() : "?"}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 16, fontWeight: 800, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{customer.name || "Unknown"}</div>
                          <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>Customer since {joinDate}</div>
                        </div>
                        <span style={{ background: "#F0FDF4", color: "#16A34A", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>Active</span>
                      </div>
                      <div style={{ background: "#F9FAFB", borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Contact Details</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span>📞</span>
                          <a href={"tel:" + customer.phone} style={{ fontSize: 14, fontWeight: 700, color: "#111827", textDecoration: "none" }}>{customer.phone || "—"}</a>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span>✉️</span>
                          <span style={{ fontSize: 13, color: "#374151", wordBreak: "break-all" }}>{customer.email || "—"}</span>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                        <div style={{ textAlign: "center", background: "#FEF2F2", borderRadius: 10, padding: "10px 4px" }}>
                          <div style={{ fontSize: 20, fontWeight: 900, color: "#DC2626" }}>{custPkgs.length}</div>
                          <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 700, textTransform: "uppercase" }}>Total</div>
                        </div>
                        <div style={{ textAlign: "center", background: "#FEF3C7", borderRadius: 10, padding: "10px 4px" }}>
                          <div style={{ fontSize: 20, fontWeight: 900, color: "#D97706" }}>{activePkgs.length}</div>
                          <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 700, textTransform: "uppercase" }}>Active</div>
                        </div>
                        <div style={{ textAlign: "center", background: "#ECFDF5", borderRadius: 10, padding: "10px 4px" }}>
                          <div style={{ fontSize: 20, fontWeight: 900, color: "#10B981" }}>{deliveredPkgs.length}</div>
                          <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 700, textTransform: "uppercase" }}>Done</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: "1px solid #F3F4F6" }}>
                        <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 600 }}>Total Spend</span>
                        <span style={{ fontSize: 16, fontWeight: 900, color: "#DC2626" }}>KES {totalSpend.toLocaleString()}</span>
                      </div>
                      {custPkgs.length > 0 && (() => {
                        const latest = custPkgs[0];
                        return (
                          <div style={{ marginTop: 12, padding: "10px 12px", background: "#F9FAFB", borderRadius: 10, border: "1px solid #F3F4F6" }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Latest Order</div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "#DC2626" }}>{latest.trackingCode}</span>
                              <StatusBadge status={latest.status} />
                            </div>
                            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{latest.description} → {latest.deliveryZone}</div>
                          </div>
                        );
                      })()}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {view === "debug" && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#111827", marginBottom: 4 }}>🔧 Debug Panel</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>Live package statuses as received from Supabase. Use this to verify what the DB actually contains.</div>
            <Card style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "monospace" }}>
                <thead>
                  <tr style={{ background: "#F9FAFB" }}>
                    {["Tracking Code","Status (raw)","riderCollectionId","riderDeliveryId","Filters match"].map(h => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#6B7280", borderBottom: "1px solid #E5E7EB", fontSize: 11, textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {packages.map(pkg => {
                    const isPendingAccept   = pkg.status === "pending_warehouse";
                    const isAtHub           = pkg.status === "at_warehouse";
                    const isPendingDelivery = pkg.status === "pending_delivery";
                    const isInTransit       = ["searching_rider","awaiting_collection","picked_up","pending_warehouse","at_warehouse","out_for_delivery","pending_delivery"].includes(pkg.status);
                    const matchLabels = [
                      isPendingAccept   && "PENDING ACCEPT",
                      isAtHub           && (pkg.riderDeliveryId ? "AT HUB (dispatched)" : "AT HUB (unassigned)"),
                      isPendingDelivery && "PENDING DELIVERY",
                      isInTransit       && "IN TRANSIT",
                    ].filter(Boolean).join(", ") || "—";
                    return (
                      <tr key={pkg.id} style={{ borderBottom: "1px solid #F3F4F6", background: (isPendingAccept || isPendingDelivery) ? "#FFF9C4" : "#fff" }}>
                        <td style={{ padding: "8px 12px", fontWeight: 700, color: "#DC2626" }}>{pkg.trackingCode}</td>
                        <td style={{ padding: "8px 12px" }}><span style={{ background: "#F3F4F6", padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>{pkg.status}</span></td>
                        <td style={{ padding: "8px 12px", color: pkg.riderCollectionId ? "#059669" : "#9CA3AF" }}>{pkg.riderCollectionId ? pkg.riderCollectionId.slice(0,8)+"…" : "null"}</td>
                        <td style={{ padding: "8px 12px", color: pkg.riderDeliveryId ? "#059669" : "#9CA3AF" }}>{pkg.riderDeliveryId ? pkg.riderDeliveryId.slice(0,8)+"…" : "null"}</td>
                        <td style={{ padding: "8px 12px", color: "#374151", fontWeight: 600 }}>{matchLabels}</td>
                      </tr>
                    );
                  })}
                  {packages.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "#9CA3AF" }}>No packages loaded</td></tr>
                  )}
                </tbody>
              </table>
            </Card>
            <Card style={{ marginTop: 16, background: "#1F2937", color: "#D1D5DB", fontFamily: "monospace", fontSize: 12 }}>
              <div style={{ fontWeight: 700, color: "#F9FAFB", marginBottom: 8 }}>Summary counts</div>
              <div>pendingAcceptance (pending_warehouse): <strong style={{ color: "#FCD34D" }}>{pendingAcceptance.length}</strong></div>
              <div>atHub (at_warehouse): <strong style={{ color: "#FCD34D" }}>{atHub.length}</strong> (unassigned: {atHubUnassigned.length}, dispatched: {atHubDispatched.length})</div>
              <div>pendingDelivery (pending_delivery): <strong style={{ color: "#FCD34D" }}>{pendingDelivery.length}</strong></div>
              <div>inTransit: <strong style={{ color: "#FCD34D" }}>{inTransit.length}</strong></div>
              <div>delivered: <strong style={{ color: "#FCD34D" }}>{delivered.length}</strong></div>
              <div>total packages: <strong style={{ color: "#FCD34D" }}>{packages.length}</strong></div>
            </Card>
          </div>
        )}

{view === "logs" && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "#111827", marginBottom: 16 }}>Chain of Custody Log</div>
            <Card>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Package","Event","Actor","Location","Notes","Timestamp"].map(h => (
                      <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...transitLogs].reverse().map((log, i) => {
                    const pkg = packages.find(p => p.id === log.packageId);
                    return (
                      <tr key={log.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                        <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "#DC2626" }}>{pkg?.trackingCode || log.packageId.slice(0,8)}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ background: "#F0FDF4", color: "#166534", padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>{log.event.replace(/_/g, " ")}</span>
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: "#374151" }}>{log.actorName} <span style={{ fontSize: 11, color: "#9CA3AF" }}>({log.actorRole})</span></td>
                        <td style={{ padding: "10px 12px", fontSize: 12, color: "#6B7280" }}>{log.location}</td>
                        <td style={{ padding: "10px 12px", fontSize: 12, color: "#DC2626", fontStyle: "italic" }}>{log.notes || "—"}</td>
                        <td style={{ padding: "10px 12px", fontSize: 12, color: "#9CA3AF", fontFamily: "monospace" }}>{new Date(log.createdAt).toLocaleTimeString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {view === "revenue" && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "#111827", marginBottom: 16 }}>Revenue & Liability Overview</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              <Card style={{ background: "linear-gradient(135deg, #DC2626, #EF4444)", color: "#fff" }}>
                <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.85, marginBottom: 8 }}>TOTAL FEES COLLECTED</div>
                <div style={{ fontSize: 36, fontWeight: 600 }}>KES {totalFees.toLocaleString()}</div>
                <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>Across {packages.length} packages</div>
              </Card>
              <Card style={{ background: "linear-gradient(135deg, #7C3AED, #9F67FA)", color: "#fff" }}>
                <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.85, marginBottom: 8 }}>GOODS IN TRANSIT (LIABILITY)</div>
                <div style={{ fontSize: 36, fontWeight: 600 }}>KES {totalValue.toLocaleString()}</div>
                <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>Across {inTransit.length} active packages</div>
              </Card>
            </div>
            <Card>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#111827", marginBottom: 16 }}>Package Fee Breakdown</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Tracking","Customer","Zone","Base Fee","Protection Fee","Total","Status"].map(h => (
                      <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {packages.map(pkg => (
                    <tr key={pkg.id} style={{ borderBottom: "1px solid #F9FAFB" }}>
                      <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 12, fontWeight: 600, color: "#DC2626" }}>{pkg.trackingCode}</td>
                      <td style={{ padding: "10px 12px", fontSize: 13, color: "#374151" }}>{pkg.customerName}</td>
                      <td style={{ padding: "10px 12px", fontSize: 13, color: "#374151" }}>{pkg.deliveryZone}</td>
                      <td style={{ padding: "10px 12px", fontSize: 13, color: "#374151" }}>KES {pkg.base}</td>
                      <td style={{ padding: "10px 12px", fontSize: 13, color: pkg.protectionFee > 0 ? "#D97706" : "#9CA3AF" }}>KES {pkg.protectionFee || "—"}</td>
                      <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600, color: "#DC2626" }}>KES {pkg.total}</td>
                      <td style={{ padding: "10px 12px" }}><StatusBadge status={pkg.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================

// ============================================================
// SUPABASE AUTH HELPERS
// ============================================================

// Map a Supabase profile row to the user shape the app expects
const profileToUser = (authUser, profile) => ({
  id:            authUser.id,
  email:         authUser.email,
  name:          profile.name,
  phone:         profile.phone,
  role:          profile.role,
  zone:          profile.home_zone,
  licenseNumber: profile.license_number,
});

// Map a Supabase package row (snake_case) to app shape (camelCase)
const dbPkgToApp = (p) => ({
  id:                   p.id,
  trackingCode:         p.tracking_code,
  customerId:           p.customer_id,
  customerName:         p.customer_name,
  riderCollectionId:    p.rider_collection_id,
  riderDeliveryId:      p.rider_delivery_id,
  pickupAddress:        p.pickup_address,
  deliveryAddress:      p.delivery_address,
  deliveryZone:         p.delivery_zone,
  description:          p.description,
  size:                 p.size,
  declaredValue:        p.declared_value,
  base:                 p.base,
  protectionFee:        p.protection_fee,
  total:                p.total,
  isHighValue:          p.is_high_value,
  status:               p.status,
  otpWarehouse:         p.otp_warehouse,
  otpDelivery:          p.otp_delivery,
  otpWarehouseVerified: p.otp_warehouse_verified,
  otpDeliveryVerified:  p.otp_delivery_verified,
  requestType:          p.request_type || 'delivery',
  collectFromName:      p.collect_from_name || '',
  collectFromPhone:     p.collect_from_phone || '',
  createdAt:            p.created_at,
});

// Map a Supabase transit_log row to app shape
const dbLogToApp = (l) => ({
  id:         l.id,
  packageId:  l.package_id,
  actorId:    l.actor_id,
  actorRole:  l.actor_role,
  actorName:  l.actor_name,
  event:      l.event,
  location:   l.location,
  notes:      l.notes,
  createdAt:  l.created_at,
});

// ============================================================
// SHARED AUTH UI (reused by Login + Signup)
// ============================================================
const AuthInput = ({ label, value, onChange, type = "text", placeholder, icon }) => (
  <div style={{ marginBottom: 16 }}>
    <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
    <div style={{ position: "relative" }}>
      {icon && <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 15, pointerEvents: "none" }}>{icon}</span>}
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", padding: icon ? "12px 14px 12px 38px" : "12px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none", color: "#111827", transition: "border 0.15s" }}
        onFocus={e => e.target.style.borderColor = "#DC2626"}
        onBlur={e => e.target.style.borderColor = "#E5E7EB"}
      />
    </div>
  </div>
);

const AuthLogo = () => (
  <div style={{ marginBottom: 28, textAlign: "center" }}>
    <div style={{ width: 64, height: 64, borderRadius: 20, background: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 12px", boxShadow: "0 8px 24px rgba(220,38,38,0.3)" }}>🏍️</div>
    <div style={{ fontSize: 32, fontWeight: 900, color: "#DC2626", letterSpacing: "-1px" }}>Baruk</div>
    <div style={{ fontSize: 14, color: "#9CA3AF", marginTop: 4 }}>Fast. Reliable. Trackable.</div>
  </div>
);

const AuthError = ({ msg }) => msg ? (
  <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#DC2626", fontWeight: 600, marginBottom: 16 }}>⚠️ {msg}</div>
) : null;

const AuthSuccess = ({ msg }) => msg ? (
  <div style={{ background: "#ECFDF5", border: "1px solid #6EE7B7", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#065F46", fontWeight: 600, marginBottom: 16 }}>✅ {msg}</div>
) : null;

const AuthBtn = ({ label, onClick, loading, disabled }) => (
  <button onClick={onClick} disabled={loading || disabled}
    style={{ width: "100%", padding: "13px", background: loading || disabled ? "#FCA5A5" : "#DC2626", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 800, cursor: loading || disabled ? "not-allowed" : "pointer", fontFamily: "inherit", marginTop: 4, transition: "background 0.15s", boxShadow: "0 2px 12px rgba(220,38,38,0.25)" }}>
    {loading ? "Please wait..." : label}
  </button>
);

// ============================================================
// SIGNUP SCREEN — customers only
// ============================================================
function SignupScreen({ onBack }) {
  const [form, setForm]     = useState({ name: "", email: "", phone: "", password: "", confirm: "" });
  const [error, setError]   = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const set = k => v => setForm(f => ({ ...f, [k]: v }));

  const handleSignup = async () => {
    setError(""); setSuccess("");
    if (!form.name || !form.email || !form.phone || !form.password || !form.confirm)
      return setError("Please fill in all fields.");
    if (form.password.length < 6)
      return setError("Password must be at least 6 characters.");
    if (form.password !== form.confirm)
      return setError("Passwords do not match.");

    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        options: {
          data: {
            name:  form.name.trim(),
            phone: form.phone.trim(),
            role:  "customer",
          },
        },
      });
      if (signUpError) throw signUpError;
      setSuccess("Account created! You are now signed in.");
      // onAuthStateChange in App will pick up the new session automatically
    } catch (err) {
      setError(err.message || "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100dvh", background: "#F9FAFB", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', system-ui, sans-serif", padding: 20, overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <AuthLogo />
        <div style={{ background: "#fff", borderRadius: 20, padding: 28, boxShadow: "0 4px 32px rgba(0,0,0,0.08)" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#111827", marginBottom: 4 }}>Create Account</div>
          <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 24 }}>Sign up to start sending packages</div>
          <AuthInput label="Full Name"         value={form.name}     onChange={set("name")}     placeholder="e.g. Amara Osei"      icon="👤" />
          <AuthInput label="Email Address"     value={form.email}    onChange={set("email")}    placeholder="you@example.com"      icon="✉️" type="email" />
          <AuthInput label="Phone Number"      value={form.phone}    onChange={set("phone")}    placeholder="e.g. 0712 345 678"    icon="📞" type="tel" />
          <AuthInput label="Password"          value={form.password} onChange={set("password")} placeholder="Min. 6 characters"    icon="🔒" type="password" />
          <AuthInput label="Confirm Password"  value={form.confirm}  onChange={set("confirm")}  placeholder="Repeat your password" icon="🔒" type="password" />
          <AuthError msg={error} />
          <AuthSuccess msg={success} />
          <AuthBtn label="Create Account" onClick={handleSignup} loading={loading} disabled={!form.name || !form.email || !form.phone || !form.password || !form.confirm} />
          <div style={{ textAlign: "center", marginTop: 20, paddingTop: 20, borderTop: "1px solid #F3F4F6" }}>
            <span style={{ fontSize: 14, color: "#6B7280" }}>Already have an account? </span>
            <button onClick={onBack} style={{ fontSize: 14, color: "#DC2626", fontWeight: 700, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Sign In</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// LOGIN SCREEN
// ============================================================
function LoginScreen({ onGoSignup }) {
  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState("");
  const [loading, setLoading]           = useState(false);

  const handleLogin = async () => {
    setError(""); setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInError) throw signInError;
      // onAuthStateChange in App will handle routing
    } catch (err) {
      setError("Incorrect email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100dvh", background: "#F9FAFB", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', system-ui, sans-serif", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <AuthLogo />
        <div style={{ background: "#fff", borderRadius: 20, padding: 28, boxShadow: "0 4px 32px rgba(0,0,0,0.08)" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#111827", marginBottom: 4 }}>Welcome back</div>
          <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 24 }}>Sign in to your Baruk account</div>
          <AuthInput label="Email" value={email} onChange={setEmail} placeholder="you@example.com" icon="✉️" type="email" />
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Password</div>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 15, pointerEvents: "none" }}>🔒</span>
              <input
                type={showPassword ? "text" : "password"} value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                placeholder="••••••••"
                style={{ width: "100%", padding: "12px 44px 12px 38px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none", color: "#111827" }}
                onFocus={e => e.target.style.borderColor = "#DC2626"}
                onBlur={e => e.target.style.borderColor = "#E5E7EB"}
              />
              <button onClick={() => setShowPassword(s => !s)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>
          <AuthError msg={error} />
          <AuthBtn label="Sign In" onClick={handleLogin} loading={loading} disabled={!email || !password} />
          <div style={{ textAlign: "center", marginTop: 20, paddingTop: 20, borderTop: "1px solid #F3F4F6" }}>
            <span style={{ fontSize: 14, color: "#6B7280" }}>New customer? </span>
            <button onClick={onGoSignup} style={{ fontSize: 14, color: "#DC2626", fontWeight: 700, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Create an account →</button>
          </div>
          <div style={{ marginTop: 16, padding: "12px 14px", background: "#F9FAFB", borderRadius: 10, border: "1px dashed #E5E7EB" }}>
            <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6 }}>
              🏍️ <strong>Riders:</strong> Your account is created by the Hub Admin. Contact your hub manager if you don't have login credentials yet.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// LOADING SCREEN
// ============================================================
const LoadingScreen = () => (
  <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F9FAFB", flexDirection: "column", gap: 16 }}>
    <div style={{ width: 64, height: 64, borderRadius: 20, background: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, boxShadow: "0 8px 24px rgba(220,38,38,0.3)" }}>🏍️</div>
    <div style={{ fontSize: 24, fontWeight: 900, color: "#DC2626" }}>Baruk</div>
    <div style={{ width: 32, height: 32, border: "3px solid #FECACA", borderTopColor: "#DC2626", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

// ============================================================
// MAIN APP — SUPABASE AUTH + REALTIME + ROLE-BASED ROUTING
// ============================================================
// PWA INSTALL BANNER
// ============================================================
function InstallBanner() {
  const [show, setShow]         = useState(false);
  const [isIOS, setIsIOS]       = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Don't show if already installed (running as standalone PWA)
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || window.navigator.standalone === true;
    if (isStandalone) return;

    // Don't show if user dismissed it this session
    if (sessionStorage.getItem("install-dismissed")) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);

    if (ios) {
      // iOS: show manual instructions after 2 seconds
      setTimeout(() => setShow(true), 2000);
    } else {
      // Android/Chrome: wait for the native beforeinstallprompt event
      const handler = (e) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setTimeout(() => setShow(true), 2000);
      };
      window.addEventListener("beforeinstallprompt", handler);
      return () => window.removeEventListener("beforeinstallprompt", handler);
    }
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setInstalling(false);
    setDeferredPrompt(null);
    setShow(false);
  };

  const handleDismiss = () => {
    setShow(false);
    sessionStorage.setItem("install-dismissed", "1");
  };

  if (!show) return null;

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: "#fff", borderTop: "2px solid #FECACA",
      boxShadow: "0 -4px 24px rgba(0,0,0,0.12)",
      padding: "16px 20px", fontFamily: "'DM Sans', system-ui, sans-serif",
      animation: "slideUp 0.3s ease-out",
    }}>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        {/* Icon */}
        <div style={{ width: 48, height: 48, borderRadius: 12, background: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0, boxShadow: "0 4px 12px rgba(220,38,38,0.3)" }}>
          🏍️
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: "#111827", marginBottom: 2 }}>
            Install Baruk App
          </div>

          {isIOS ? (
            <div style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.5 }}>
              Tap <strong style={{ color: "#111827" }}>Share</strong> <span style={{ fontSize: 16 }}>⎋</span> at the bottom of Safari, then <strong style={{ color: "#111827" }}>"Add to Home Screen"</strong>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "#6B7280" }}>
              Get the full app experience — works offline, opens instantly
            </div>
          )}

          {!isIOS && (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={handleInstall} disabled={installing}
                style={{ background: "#DC2626", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 2px 8px rgba(220,38,38,0.3)" }}>
                {installing ? "Installing..." : "Install Now"}
              </button>
              <button onClick={handleDismiss}
                style={{ background: "#F3F4F6", color: "#6B7280", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                Not now
              </button>
            </div>
          )}
        </div>

        {/* Close */}
        <button onClick={handleDismiss}
          style={{ background: "none", border: "none", fontSize: 20, color: "#9CA3AF", cursor: "pointer", padding: 4, lineHeight: 1, flexShrink: 0 }}>
          ✕
        </button>
      </div>

      {/* iOS step indicators */}
      {isIOS && (
        <div style={{ display: "flex", gap: 8, marginTop: 12, paddingTop: 12, borderTop: "1px solid #F3F4F6" }}>
          {[["1", "Open in Safari"], ["2", "Tap Share ⎋"], ["3", "Add to Home Screen"]].map(([n, label]) => (
            <div key={n} style={{ flex: 1, textAlign: "center", background: "#FEF2F2", borderRadius: 8, padding: "8px 4px" }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#DC2626" }}>{n}</div>
              <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 700, marginTop: 2, lineHeight: 1.3 }}>{label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
export default function App() {
  const [user, setUser]         = useState(null);
  const [authView, setAuthView] = useState("login");
  const [appLoading, setAppLoading] = useState(true);
  const [packages, setPackages] = useState([]);
  const [logs, setLogs]         = useState([]);
  const [riders, setRiders]     = useState([]);
  const realtimeRef             = useRef(null);

  // ── Fetch profile from DB after auth ──
  const loadProfile = useCallback(async (authUser) => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .single();
    if (profile) setUser(profileToUser(authUser, profile));
  }, []);

  // ── Fetch initial data ──
  const loadPackages = useCallback(async () => {
    const { data } = await supabase.from("packages").select("*").order("created_at", { ascending: false });
    if (data) setPackages(data.map(dbPkgToApp));
  }, []);

  const loadLogs = useCallback(async () => {
    const { data } = await supabase.from("transit_logs").select("*").order("created_at", { ascending: true });
    if (data) setLogs(data.map(dbLogToApp));
  }, []);

  const loadRiders = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("*").eq("role", "rider");
    if (data) setRiders(data.map(p => ({ id: p.id, name: p.name, phone: p.phone, zone: p.home_zone, licenseNumber: p.license_number, role: "rider" })));
  }, []);

  const [customers, setCustomers] = useState([]);
  const loadCustomers = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("*").eq("role", "customer");
    if (data) setCustomers(data.map(p => ({ id: p.id, name: p.name, phone: p.phone, email: p.email, role: "customer", createdAt: p.created_at })));
  }, []);

  // ── Auth state listener ──
  useEffect(() => {
    // Check existing session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) { loadProfile(session.user); }
      setAppLoading(false);
    });

    // Listen for login/logout
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) { loadProfile(session.user); }
      else { setUser(null); setPackages([]); setLogs([]); }
    });
    return () => subscription.unsubscribe();
  }, [loadProfile]);

  // ── Load data + set up realtime when user is ready ──
  useEffect(() => {
    if (!user) return;
    loadPackages();
    loadLogs();
    loadRiders();
    loadCustomers();

    // Realtime subscriptions
    const channel = supabase.channel("baruk-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "packages" }, () => loadPackages())
      .on("postgres_changes", { event: "*", schema: "public", table: "transit_logs" }, () => loadLogs())
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => loadRiders())
      .subscribe();

    realtimeRef.current = channel;
    return () => supabase.removeChannel(channel);
  }, [user, loadPackages, loadLogs, loadRiders]);

  // ── Logout ──
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  // ── Add log entry to DB ──
  const addLog = async (packageId, actorId, actorRole, actorName, event, location, notes = null) => {
    await supabase.from("transit_logs").insert({
      package_id: packageId, actor_id: actorId, actor_role: actorRole,
      actor_name: actorName, event, location, notes,
    });
  };

  // ── Update package in DB + immediately reflect in local state ──
  const updatePkg = async (id, updates) => {
    // 1. Optimistically update local state NOW so UI responds instantly
    setPackages(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));

    // 2. Convert camelCase app fields back to snake_case for DB
    const dbUpdates = {};
    if (updates.status               !== undefined) dbUpdates.status                    = updates.status;
    if (updates.riderCollectionId    !== undefined) dbUpdates.rider_collection_id        = updates.riderCollectionId;
    if (updates.riderDeliveryId      !== undefined) dbUpdates.rider_delivery_id          = updates.riderDeliveryId;
    if (updates.otpWarehouseVerified !== undefined) dbUpdates.otp_warehouse_verified     = updates.otpWarehouseVerified;
    if (updates.otpDeliveryVerified  !== undefined) dbUpdates.otp_delivery_verified      = updates.otpDeliveryVerified;

    const { error } = await supabase.from("packages").update(dbUpdates).eq("id", id);
    if (error) {
      // Roll back optimistic update on failure by reloading from DB
      console.error("[updatePkg] failed:", error);
      const { data } = await supabase.from("packages").select("*").eq("id", id).single();
      if (data) setPackages(prev => prev.map(p => p.id === id ? dbPkgToApp(data) : p));
    }
  };

  // ── Create new package ──
  const onCreatePackage = async (form) => {
    const { base, protectionFee, total, isHighValue, riderPay } = calcFees(parseFloat(form.declaredValue) || 0, form.deliveryZone);
    const trackingCode = generateTracking();
    const { data, error } = await supabase.from("packages").insert({
      tracking_code:          trackingCode,
      customer_id:            user.id,
      customer_name:          user.name,
      pickup_address:         form.pickupAddress,
      delivery_address:       form.deliveryAddress,
      delivery_zone:          form.deliveryZone,
      description:            form.description,
      size:                   form.size,
      declared_value:         parseFloat(form.declaredValue) || 0,
      base, protection_fee:   protectionFee, total,
      is_high_value:          isHighValue,
      status:                 "searching_rider",
      request_type:           form.requestType || "delivery",
      collect_from_name:      form.collectFromName || null,
      collect_from_phone:     form.collectFromPhone || null,
      otp_warehouse:          isHighValue ? generateOTP() : null,
      otp_delivery:           isHighValue ? generateOTP() : null,
    }).select().single();
    if (data) {
      const evtLabel = form.requestType === "pickup_request" ? "PICKUP_REQUESTED" : "ORDER_PLACED";
      const evtNote  = form.requestType === "pickup_request"
        ? `Pickup from ${form.collectFromName || form.pickupAddress} — KES ${total}`
        : `Booking confirmed — KES ${total}`;
      await addLog(data.id, user.id, "customer", user.name, evtLabel, form.pickupAddress, evtNote);
      return dbPkgToApp(data);
    }
  };

  // ── Rider actions ──
  const onAcceptCollection = async (pkgId, riderId) => {
    const pkg = packages.find(p => p.id === pkgId);
    await updatePkg(pkgId, { riderCollectionId: riderId, status: "awaiting_collection" });
    await addLog(pkgId, user.id, "rider", user.name, "ACCEPTED_ORDER", pkg?.pickupAddress, `${user.name} accepted — heading to collect`);
  };

  const onConfirmCollection = async (pkgId) => {
    const pkg = packages.find(p => p.id === pkgId);
    await updatePkg(pkgId, { status: "picked_up" });
    await addLog(pkgId, user.id, "rider", user.name, "COLLECTED_FROM_CUSTOMER", pkg?.pickupAddress, "Package physically collected from sender");
  };

  const onMarkAtWarehouse = async (pkgId) => {
    await updatePkg(pkgId, { status: "pending_warehouse" });
    await addLog(pkgId, user.id, "rider", user.name, "ARRIVED_AT_WAREHOUSE", "Baruk Central, CBD", "Awaiting warehouse acceptance");
  };

  const onAcceptAtWarehouse = async (pkgId) => {
    await updatePkg(pkgId, { status: "at_warehouse" });
    await addLog(pkgId, user.id, "admin", user.name, "WAREHOUSE_ACCEPTED", "Baruk Central, CBD", "Condition verified — package accepted at hub");
  };

  const onCollectedFromWarehouse = async (pkgId) => {
    await updatePkg(pkgId, { status: "out_for_delivery" });
    await addLog(pkgId, user.id, "rider", user.name, "COLLECTED_FROM_WAREHOUSE", "Baruk Central, CBD", "Package collected from hub — heading to customer");
  };

  const onDispatch = async (pkgId, riderId) => {
    const assignedRider = riders.find(r => r.id === riderId);
    await updatePkg(pkgId, { riderDeliveryId: riderId });
    await addLog(pkgId, user.id, "admin", user.name, "DISPATCHED_TO_RIDER", "Baruk Central, CBD", `Assigned to ${assignedRider?.name || riderId} — awaiting collection from hub`);
  };

  const onAcceptDelivery = async (pkgId) => {
    await updatePkg(pkgId, { status: "out_for_delivery" });
    await addLog(pkgId, user.id, "rider", user.name, "ACCEPTED_DELIVERY_JOB", "Baruk Central, CBD", "Rider accepted delivery job — heading out");
  };

  const onVerifyOTP = async (pkgId, type) => {
    const pkg = packages.find(p => p.id === pkgId);
    if (type === "warehouse") {
      await updatePkg(pkgId, { otpWarehouseVerified: true });
      await addLog(pkgId, user.id, "rider", user.name, "OTP_WAREHOUSE_VERIFIED", "Baruk Central, CBD", "High-value handoff confirmed");
    } else {
      await updatePkg(pkgId, { otpDeliveryVerified: true });
      await addLog(pkgId, user.id, "rider", user.name, "OTP_DELIVERY_VERIFIED", pkg?.deliveryAddress, "High-value delivery OTP confirmed");
    }
  };

  const onMarkDelivered = async (pkgId) => {
    const pkg = packages.find(p => p.id === pkgId);
    await updatePkg(pkgId, { status: "pending_delivery" });
    await addLog(pkgId, user.id, "rider", user.name, "DELIVERY_REPORTED", pkg?.deliveryAddress || "Customer address", "Rider reports package delivered — awaiting admin confirmation");
  };

  const onConfirmDelivery = async (pkgId) => {
    const pkg = packages.find(p => p.id === pkgId);
    await updatePkg(pkgId, { status: "delivered" });
    await addLog(pkgId, user.id, "admin", user.name, "DELIVERY_CONFIRMED", pkg?.deliveryAddress || "Customer address", "Delivery confirmed by admin");
  };

  // ── Admin creates rider account ──
  const onAddRider = async (riderData) => {
    // Create auth user via Supabase Admin API
    // NOTE: In production use a Supabase Edge Function for this
    // For now we use signUp — rider will receive a confirmation email
    const { data, error } = await supabase.auth.signUp({
      email: riderData.email,
      password: riderData.password,
      options: {
        data: {
          name:           riderData.name,
          phone:          riderData.phone,
          role:           "rider",
          home_zone:      riderData.zone,
          license_number: riderData.licenseNumber,
        },
      },
    });
    if (error) throw error;
    return data;
  };

  // ── Render ──
  if (appLoading) return <LoadingScreen />;

  if (!user) {
    if (authView === "signup") return <><SignupScreen onBack={() => setAuthView("login")} /><InstallBanner /></>;
    return <><LoginScreen onGoSignup={() => setAuthView("signup")} /><InstallBanner /></>;
  }

  const TopBar = () => (
    <div style={{ background: "#111827", padding: "10px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 100 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22C55E" }} />
        <span style={{ fontSize: 13, color: "#D1D5DB", fontWeight: 700 }}>{user.name}</span>
        <span style={{ fontSize: 11, background: "#374151", color: "#9CA3AF", padding: "2px 8px", borderRadius: 20, fontWeight: 700, textTransform: "uppercase" }}>{user.role}</span>
        {user.zone && <span style={{ fontSize: 11, background: "#DC2626", color: "#fff", padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>📍 {user.zone}</span>}
      </div>
      <button onClick={handleLogout} style={{ background: "#374151", border: "none", color: "#9CA3AF", padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
        Sign Out
      </button>
    </div>
  );

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: "#F1F5F9", minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <TopBar />
      {user.role === "customer" && <CustomerApp packages={packages.filter(p => p.customerId === user.id)} onCreatePackage={onCreatePackage} transitLogs={logs} />}
      {user.role === "rider"    && <RiderApp packages={packages} onAcceptCollection={onAcceptCollection} onConfirmCollection={onConfirmCollection} onMarkAtWarehouse={onMarkAtWarehouse} onCollectedFromWarehouse={onCollectedFromWarehouse} onAcceptDelivery={onAcceptDelivery} onVerifyOTP={onVerifyOTP} onMarkDelivered={onMarkDelivered} transitLogs={logs} currentRider={user} customers={customers} />}
      {user.role === "admin"    && <AdminDashboard packages={packages} riders={riders} customers={customers} transitLogs={logs} onDispatch={onDispatch} onAcceptAtWarehouse={onAcceptAtWarehouse} onConfirmDelivery={onConfirmDelivery} onAddRider={onAddRider} accounts={[...riders, user]} onRefresh={loadPackages} />}
      <InstallBanner />
    </div>
  );
}
