import { useState, useEffect, useCallback } from "react";

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
const ZONES = ["Westlands","Kasarani","CBD","Ngong","Embakasi","Thika Road","Karen","Ruiru"];

const generateOTP = () => Math.floor(1000 + Math.random() * 9000).toString();
const generateTracking = () => "MHB-" + Math.random().toString(36).substring(2,8).toUpperCase();

const calcFees = (declaredValue) => {
  const base = 200;
  const protectionFee = declaredValue > 5000 ? Math.round(declaredValue * 0.015) : 0;
  return { base, protectionFee, total: base + protectionFee, isHighValue: declaredValue > 10000 };
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
    searching_rider: { label: "Searching Rider", color: "#F59E0B", bg: "#FEF3C7" },
    picked_up:       { label: "Picked Up", color: "#F87171", bg: "#FEF2F2" },
    at_warehouse:    { label: "At Warehouse", color: "#8B5CF6", bg: "#EDE9FE" },
    out_for_delivery:{ label: "Out for Delivery", color: "#10B981", bg: "#D1FAE5" },
    delivered:       { label: "Delivered", color: "#059669", bg: "#ECFDF5" },
    cancelled:       { label: "Cancelled", color: "#EF4444", bg: "#FEE2E2" },
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

const Card = ({ children, style = {} }) => (
  <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.07), 0 4px 20px rgba(0,0,0,0.04)", ...style }}>
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
function CustomerApp({ packages, onCreatePackage, transitLogs }) {
  const [view, setView] = useState("track"); // "track" | "new"
  const [form, setForm] = useState({ pickupAddress: "", deliveryAddress: "", deliveryZone: ZONES[0], description: "", size: "small", declaredValue: "" });
  const [submitted, setSubmitted] = useState(null);
  const [expandedPkg, setExpandedPkg] = useState(null);

  const myPackages = packages.filter(p => p.customerId === "cust-current");
  const fees = calcFees(parseFloat(form.declaredValue) || 0);

  const handleSubmit = () => {
    if (!form.pickupAddress || !form.deliveryAddress || !form.description) return;
    const pkg = onCreatePackage(form);
    setSubmitted(pkg);
    setView("track");
    setForm({ pickupAddress: "", deliveryAddress: "", deliveryZone: ZONES[0], description: "", size: "small", declaredValue: "" });
  };

  const TrackingProgress = ({ status }) => {
    const steps = ["searching_rider","picked_up","at_warehouse","out_for_delivery","delivered"];
    const idx = steps.indexOf(status);
    const labels = ["Searching","Picked Up","At Warehouse","Out for Delivery","Delivered"];
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 0, margin: "16px 0" }}>
        {steps.map((s, i) => (
          <div key={s} style={{ display: "flex", alignItems: "center", flex: 1 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: i <= idx ? "#DC2626" : "#E5E7EB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: i <= idx ? "#fff" : "#9CA3AF", fontWeight: 600, flexShrink: 0 }}>
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

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#fff", padding: "20px 20px 0", borderRadius: "0 0 24px 24px", borderBottom: "2px solid #FECACA", boxShadow: "0 2px 16px rgba(220,38,38,0.08)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 600, color: "#DC2626", letterSpacing: "0.01em" }}>Baruk</div>
            <div style={{ fontSize: 12, color: "#EF4444" }}>Fast. Reliable. Trackable.</div>
          </div>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#FEE2E2", border: "1.5px solid #FECACA", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>👤</div>
        </div>
        <div style={{ display: "flex", gap: 4, paddingBottom: 0 }}>
          {["track","new"].map(v => (
            <button key={v} onClick={() => setView(v)} style={{ flex: 1, padding: "10px 0", border: "none", background: view === v ? "#DC2626" : "transparent", color: view === v ? "#fff" : "#DC2626", fontWeight: 600, borderRadius: "10px 10px 0 0", cursor: "pointer", fontSize: 14, fontFamily: "inherit", borderTop: view === v ? "none" : "1.5px solid #FECACA" }}>
              {v === "track" ? "📦 My Orders" : "＋ New Order"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "20px 16px" }}>
        {view === "new" ? (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "#111827", marginBottom: 20, marginTop: 0 }}>Book a Delivery</h2>
            <Card>
              <Input label="Pickup Address" value={form.pickupAddress} onChange={v => setForm(f => ({...f, pickupAddress: v}))} placeholder="Where should we collect from?" />
              <Input label="Delivery Address" value={form.deliveryAddress} onChange={v => setForm(f => ({...f, deliveryAddress: v}))} placeholder="Where should we deliver to?" />
              <Select label="Delivery Zone" value={form.deliveryZone} onChange={v => setForm(f => ({...f, deliveryZone: v}))} options={ZONES.map(z => ({value: z, label: z}))} />
              <Input label="Item Description" value={form.description} onChange={v => setForm(f => ({...f, description: v}))} placeholder="e.g. Electronics, Documents..." />
              <Select label="Package Size" value={form.size} onChange={v => setForm(f => ({...f, size: v}))} options={[{value:"small",label:"Small (under 5kg)"},{value:"medium",label:"Medium (5-15kg)"},{value:"large",label:"Large (15kg+)"}]} />
              <Input label="Declared Value (KES)" value={form.declaredValue} onChange={v => setForm(f => ({...f, declaredValue: v}))} type="number" placeholder="0" />
            </Card>

            {/* Fee Preview */}
            <Card style={{ marginTop: 12, background: "#FEF2F2", border: "1.5px solid #FECACA" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#7F1D1D", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>Fee Breakdown</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "#6B7280", fontSize: 14 }}>Base Rate</span>
                <span style={{ fontWeight: 700, color: "#111827" }}>KES {fees.base}</span>
              </div>
              {fees.protectionFee > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ color: "#6B7280", fontSize: 14 }}>Delivery Protection (1.5%)</span>
                  <span style={{ fontWeight: 700, color: "#DC2626" }}>KES {fees.protectionFee}</span>
                </div>
              )}
              <div style={{ borderTop: "1px solid #FECACA", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 600, color: "#111827" }}>Total</span>
                <span style={{ fontWeight: 600, color: "#DC2626", fontSize: 18 }}>KES {fees.total}</span>
              </div>
              {fees.isHighValue && (
                <div style={{ marginTop: 10, padding: "8px 12px", background: "#FEF2F2", borderRadius: 8, fontSize: 12, color: "#DC2626", fontWeight: 600 }}>
                  ⚡ High Value Item — OTP verification required at handoff points
                </div>
              )}
            </Card>
            <Btn onClick={handleSubmit} style={{ width: "100%", marginTop: 16 }} size="lg">Confirm & Book — KES {fees.total}</Btn>
          </div>
        ) : (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "#111827", marginBottom: 16, marginTop: 0 }}>Your Deliveries</h2>
            {submitted && (
              <Card style={{ marginBottom: 12, background: "#ECFDF5", border: "1.5px solid #6EE7B7" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#065F46" }}>✅ Order placed! Tracking: {submitted.trackingCode}</div>
              </Card>
            )}
            {[...myPackages, ...packages.slice(0, 2)].map(pkg => (
              <Card key={pkg.id} style={{ marginBottom: 12, cursor: "pointer" }} onClick={() => setExpandedPkg(expandedPkg === pkg.id ? null : pkg.id)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", fontFamily: "monospace" }}>{pkg.trackingCode}</div>
                    <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>{pkg.description}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <StatusBadge status={pkg.status} />
                    {pkg.isHighValue && <HighValueBadge />}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#9CA3AF" }}>→ {pkg.deliveryAddress}</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
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
function RiderApp({ packages, onAcceptCollection, onMarkAtWarehouse, onAcceptDelivery, onVerifyOTP, onMarkDelivered, transitLogs, currentRider }) {
  const rider = currentRider || RIDERS[0];
  const [feed, setFeed] = useState("collection");
  const [otpInput, setOtpInput] = useState({});
  const [otpError, setOtpError] = useState({});

  const collectionFeed = packages.filter(p => p.status === "searching_rider" && p.deliveryZone !== rider.zone);
  const myActive = packages.filter(p => p.riderCollectionId === rider.id || p.riderDeliveryId === rider.id);
  const deliveryFeed = packages.filter(p => p.status === "at_warehouse" && p.deliveryZone === rider.zone && !p.riderDeliveryId);

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
    const isMyDelivery = pkg.riderDeliveryId === rider.id;
    const needsWarehouseOTP = pkg.isHighValue && isMyCollection && pkg.status === "at_warehouse" && !pkg.otpWarehouseVerified;
    const needsDeliveryOTP = pkg.isHighValue && isMyDelivery && pkg.status === "out_for_delivery" && !pkg.otpDeliveryVerified;

    return (
      <Card style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontFamily: "monospace", fontWeight: 600, fontSize: 13, color: "#111827" }}>{pkg.trackingCode}</div>
          <div style={{ display: "flex", gap: 6 }}>
            <StatusBadge status={pkg.status} />
            {pkg.isHighValue && <HighValueBadge />}
          </div>
        </div>
        <div style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>{pkg.description}</div>
        <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
          📍 {pkg.pickupAddress}<br/>
          🏠 → {pkg.deliveryAddress}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12, color: "#9CA3AF" }}>
          <span>Zone: <strong style={{ color: "#374151" }}>{pkg.deliveryZone}</strong></span>
          <span>KES {pkg.declaredValue.toLocaleString()} value</span>
        </div>

        {/* Actions */}
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {pkg.status === "searching_rider" && !isMyCollection && (
            <Btn onClick={() => onAcceptCollection(pkg.id, rider.id)} variant="primary">Accept Collection</Btn>
          )}
          {pkg.status === "searching_rider" && isMyCollection && (
            <Btn onClick={() => onMarkAtWarehouse(pkg.id, rider.id)} variant="success">✓ Mark: Arrived at Warehouse</Btn>
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
          {pkg.status === "at_warehouse" && !isMyDelivery && pkg.deliveryZone === rider.zone && (
            <Btn onClick={() => onAcceptDelivery(pkg.id, rider.id)} variant="primary">Accept Delivery</Btn>
          )}
          {needsDeliveryOTP && (
            <div style={{ background: "#FEF2F2", border: "1.5px solid #FCA5A5", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#7F1D1D", marginBottom: 8 }}>🔐 Customer OTP Verification</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input maxLength={4} value={otpInput[`${pkg.id}-delivery`] || ""} onChange={e => setOtpInput(o => ({...o, [`${pkg.id}-delivery`]: e.target.value}))}
                  placeholder="- - - -" style={{ flex: 1, padding: "8px 12px", border: `1.5px solid ${otpError[`${pkg.id}-delivery`] ? "#EF4444" : "#E5E7EB"}`, borderRadius: 8, fontSize: 18, textAlign: "center", letterSpacing: 6, fontFamily: "monospace" }} />
                <Btn onClick={() => handleOTPVerify(pkg, "delivery")} variant="purple" size="sm">Verify</Btn>
              </div>
              {otpError[`${pkg.id}-delivery`] && <div style={{ color: "#EF4444", fontSize: 12, marginTop: 6 }}>❌ Incorrect OTP. Try again.</div>}
            </div>
          )}
          {pkg.status === "out_for_delivery" && isMyDelivery && (!pkg.isHighValue || pkg.otpDeliveryVerified) && (
            <Btn onClick={() => onMarkDelivered(pkg.id, rider.id)} variant="success">✓ Mark as Delivered</Btn>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      {/* Header */}
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
          {[["collection","🏠 Collection Feed"],["delivery","📦 Delivery Feed"],["active","⚡ My Active"]].map(([v,l]) => (
            <button key={v} onClick={() => setFeed(v)} style={{ flex: 1, padding: "10px 4px", border: "none", background: feed === v ? "#fff" : "transparent", color: feed === v ? "#1F2937" : "rgba(255,255,255,0.6)", fontWeight: 600, borderRadius: "8px 8px 0 0", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: "16px" }}>
        {feed === "collection" && (
          <div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 12 }}>Packages in your zone to collect & bring to Hub:</div>
            {collectionFeed.length === 0 ? <Card style={{ textAlign: "center", color: "#9CA3AF" }}>No collection requests right now</Card> :
              collectionFeed.map(p => <PkgCard key={p.id} pkg={p} />)}
          </div>
        )}
        {feed === "delivery" && (
          <div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 12 }}>Packages at Hub destined for <strong>{rider.zone}</strong>:</div>
            {deliveryFeed.length === 0 ? <Card style={{ textAlign: "center", color: "#9CA3AF" }}>No deliveries waiting for your zone</Card> :
              deliveryFeed.map(p => <PkgCard key={p.id} pkg={p} />)}
          </div>
        )}
        {feed === "active" && (
          <div>
            {myActive.length === 0 ? <Card style={{ textAlign: "center", color: "#9CA3AF" }}>No active packages</Card> :
              myActive.map(p => <PkgCard key={p.id} pkg={p} />)}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// ADMIN DASHBOARD
// ============================================================
function AdminDashboard({ packages, riders, transitLogs, onDispatch, onAddRider, accounts }) {
  const [view, setView] = useState("hub");
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

  const atHub = packages.filter(p => p.status === "at_warehouse");
  const inTransit = packages.filter(p => ["searching_rider","picked_up","out_for_delivery"].includes(p.status));
  const delivered = packages.filter(p => p.status === "delivered");
  const totalFees = packages.reduce((s, p) => s + p.total, 0);
  const totalValue = inTransit.reduce((s, p) => s + p.declaredValue, 0);

  const handleDispatch = (pkg) => {
    if (!selectedRider) return;
    onDispatch(pkg.id, selectedRider);
    setSelectedPkg(null);
    setSelectedRider("");
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
        <div style={{ display: "flex", gap: 8 }}>
          {[["hub","📦 Hub Inventory"],["riders","🏍️ Riders"],["logs","📋 Custody Logs"],["revenue","💰 Revenue"]].map(([v, l]) => (
            <button key={v} onClick={() => setView(v)} style={{ padding: "6px 14px", border: "none", background: view === v ? "#DC2626" : "#F3F4F6", color: view === v ? "#fff" : "#6B7280", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: 24 }}>
        {/* Stats Bar */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
          {[
            { label: "At Hub", value: atHub.length, sub: "packages", color: "#DC2626" },
            { label: "In Transit", value: inTransit.length, sub: "packages", color: "#EF4444" },
            { label: "Delivered Today", value: delivered.length, sub: "packages", color: "#10B981" },
            { label: "Revenue", value: `KES ${totalFees.toLocaleString()}`, sub: "collected", color: "#DC2626" },
          ].map(s => (
            <Card key={s.label} style={{ textAlign: "center" }}>
              <Stat {...s} />
            </Card>
          ))}
        </div>

        {view === "hub" && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "#111827", marginBottom: 16 }}>Hub Inventory — {atHub.length} Packages</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <thead>
                  <tr style={{ background: "#F9FAFB" }}>
                    {["Tracking","Description","Customer","Destination Zone","Value","Fees","Flags","Action"].map(h => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {atHub.map((pkg, i) => (
                    <tr key={pkg.id} style={{ borderBottom: i < atHub.length - 1 ? "1px solid #F3F4F6" : "none", background: selectedPkg?.id === pkg.id ? "#FEF2F2" : "#fff" }}>
                      <td style={{ padding: "12px 16px", fontFamily: "monospace", fontWeight: 600, fontSize: 13, color: "#111827" }}>{pkg.trackingCode}</td>
                      <td style={{ padding: "12px 16px", fontSize: 13, color: "#374151" }}>{pkg.description}</td>
                      <td style={{ padding: "12px 16px", fontSize: 13, color: "#374151" }}>{pkg.customerName}</td>
                      <td style={{ padding: "12px 16px" }}><span style={{ background: "#FEF2F2", color: "#DC2626", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{pkg.deliveryZone}</span></td>
                      <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: "#111827" }}>KES {pkg.declaredValue.toLocaleString()}</td>
                      <td style={{ padding: "12px 16px", fontSize: 13, color: "#DC2626", fontWeight: 700 }}>KES {pkg.total}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {pkg.isHighValue && <HighValueBadge />}
                          {pkg.isHighValue && !pkg.otpWarehouseVerified && (
                            <span style={{ fontSize: 10, color: "#DC2626", fontWeight: 700 }}>⚠ OTP PENDING</span>
                          )}
                          {pkg.protectionFee > 0 && (
                            <span style={{ fontSize: 10, background: "#FEF3C7", color: "#7F1D1D", padding: "2px 6px", borderRadius: 10, fontWeight: 700 }}>PROTECTED</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {selectedPkg?.id === pkg.id ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 180 }}>
                            <select value={selectedRider} onChange={e => setSelectedRider(e.target.value)} style={{ padding: "6px 10px", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 13, fontFamily: "inherit" }}>
                              <option value="">Select Rider...</option>
                              {riders.filter(r => r.zone === pkg.deliveryZone).map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                              ))}
                              {riders.filter(r => r.zone === pkg.deliveryZone).length === 0 &&
                                riders.map(r => <option key={r.id} value={r.id}>{r.name} ({r.zone})</option>)}
                            </select>
                            <div style={{ display: "flex", gap: 6 }}>
                              <Btn onClick={() => handleDispatch(pkg)} variant="success" size="sm" disabled={!selectedRider}>Dispatch</Btn>
                              <Btn onClick={() => setSelectedPkg(null)} variant="ghost" size="sm">Cancel</Btn>
                            </div>
                          </div>
                        ) : (
                          <Btn onClick={() => setSelectedPkg(pkg)} variant="primary" size="sm">Dispatch →</Btn>
                        )}
                      </td>
                    </tr>
                  ))}
                  {atHub.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "#9CA3AF" }}>No packages at hub right now</td></tr>
                  )}
                </tbody>
              </table>
            </div>
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
// ACCOUNT STORE (replace with Supabase Auth later)
// ============================================================
const ADMIN_ACCOUNTS = [
  { id: "admin-01", email: "admin@baruk.co", password: "admin123", role: "admin", name: "Hub Admin" },
];

const SEED_ACCOUNTS = [
  { id: "cust-demo", email: "customer@baruk.co", password: "customer123", role: "customer", name: "Amara Osei",    phone: "0712000001" },
  { id: "rider-01",  email: "kip@baruk.co",      password: "rider123",    role: "rider",    name: "Kip Mutai",     phone: "0712345001", zone: "Westlands", licenseNumber: "DL-2021-001" },
  { id: "rider-02",  email: "faith@baruk.co",    password: "rider123",    role: "rider",    name: "Faith Wanjiru", phone: "0712345002", zone: "Ngong",      licenseNumber: "DL-2021-002" },
];

// ─── Shared auth UI primitives ────────────────────────────────
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
function SignupScreen({ onSignup, onBack, accounts }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirm: "" });
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const set = k => v => setForm(f => ({ ...f, [k]: v }));

  const handleSignup = () => {
    setError(""); setSuccess("");
    if (!form.name || !form.email || !form.phone || !form.password || !form.confirm)
      return setError("Please fill in all fields.");
    if (form.password.length < 6)
      return setError("Password must be at least 6 characters.");
    if (form.password !== form.confirm)
      return setError("Passwords do not match.");
    if (accounts.find(a => a.email === form.email.trim().toLowerCase()))
      return setError("An account with this email already exists.");
    setLoading(true);
    setTimeout(() => {
      const newUser = {
        id: `cust-${Date.now()}`, role: "customer",
        name: form.name.trim(), email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(), password: form.password,
      };
      onSignup(newUser);
      setLoading(false);
    }, 900);
  };

  const allFilled = form.name && form.email && form.phone && form.password && form.confirm;

  return (
    <div style={{ minHeight: "100dvh", background: "#F9FAFB", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', system-ui, sans-serif", padding: 20, overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <AuthLogo />
        <div style={{ background: "#fff", borderRadius: 20, padding: 28, boxShadow: "0 4px 32px rgba(0,0,0,0.08)" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#111827", marginBottom: 4 }}>Create Account</div>
          <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 24 }}>Sign up to start sending packages</div>

          <AuthInput label="Full Name"          value={form.name}     onChange={set("name")}     placeholder="e.g. Amara Osei"      icon="👤" />
          <AuthInput label="Email Address"      value={form.email}    onChange={set("email")}    placeholder="you@example.com"      icon="✉️" type="email" />
          <AuthInput label="Phone Number"       value={form.phone}    onChange={set("phone")}    placeholder="e.g. 0712 345 678"    icon="📞" type="tel" />
          <AuthInput label="Password"           value={form.password} onChange={set("password")} placeholder="Min. 6 characters"    icon="🔒" type="password" />
          <AuthInput label="Confirm Password"   value={form.confirm}  onChange={set("confirm")}  placeholder="Repeat your password" icon="🔒" type="password" />

          <AuthError msg={error} />
          <AuthBtn label="Create Account" onClick={handleSignup} loading={loading} disabled={!allFilled} />

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
function LoginScreen({ onLogin, onGoSignup, accounts }) {
  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState("");
  const [loading, setLoading]           = useState(false);

  const allAccounts = [...ADMIN_ACCOUNTS, ...accounts];

  const handleLogin = () => {
    setError(""); setLoading(true);
    setTimeout(() => {
      const user = allAccounts.find(a => a.email === email.trim().toLowerCase() && a.password === password);
      if (user) { onLogin(user); }
      else { setError("Incorrect email or password. Please try again."); }
      setLoading(false);
    }, 800);
  };

  return (
    <div style={{ minHeight: "100dvh", background: "#F9FAFB", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', system-ui, sans-serif", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <AuthLogo />
        <div style={{ background: "#fff", borderRadius: 20, padding: 28, boxShadow: "0 4px 32px rgba(0,0,0,0.08)" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#111827", marginBottom: 4 }}>Welcome back</div>
          <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 24 }}>Sign in to your Baruk account</div>

          <AuthInput label="Email" value={email} onChange={setEmail} placeholder="you@example.com" icon="✉️" type="email" />

          {/* Password with show/hide */}
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

          {/* Customer signup link */}
          <div style={{ textAlign: "center", marginTop: 20, paddingTop: 20, borderTop: "1px solid #F3F4F6" }}>
            <span style={{ fontSize: 14, color: "#6B7280" }}>New customer? </span>
            <button onClick={onGoSignup} style={{ fontSize: 14, color: "#DC2626", fontWeight: 700, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Create an account →</button>
          </div>

          {/* Rider notice */}
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
// MAIN APP — AUTH + SIGNUP + STATE ENGINE + ROLE-BASED ROUTING
// ============================================================
export default function App() {
  const [user, setUser]         = useState(null);
  const [authView, setAuthView] = useState("login"); // "login" | "signup"
  const [accounts, setAccounts] = useState(SEED_ACCOUNTS);
  const [packages, setPackages] = useState(initialPackages);
  const [logs, setLogs]         = useState(initialLogs);

  const handleLogin   = (u) => { setUser(u); setAuthView("login"); };
  const handleLogout  = ()  => setUser(null);

  // Customer self-signup
  const handleSignup = (newUser) => {
    setAccounts(a => [...a, newUser]);
    setUser(newUser);
    setAuthView("login");
  };

  // Admin creates a rider account
  const handleAddRider = (newRider) => {
    setAccounts(a => [...a, newRider]);
  };

  const addLog = (packageId, actorId, actorRole, actorName, event, location, notes = null) => {
    const log = { id: `log-${Date.now()}`, packageId, actorId, actorRole, actorName, event, location, notes, createdAt: new Date().toISOString() };
    setLogs(l => [...l, log]);
    return log;
  };

  const updatePkg = (id, updates) => {
    setPackages(ps => ps.map(p => p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p));
  };

  const onCreatePackage = (form) => {
    const { base, protectionFee, total, isHighValue } = calcFees(parseFloat(form.declaredValue) || 0);
    const pkg = {
      id: `pkg-${Date.now()}`, trackingCode: generateTracking(), customerId: user.id, customerName: user.name,
      riderCollectionId: null, riderDeliveryId: null,
      pickupAddress: form.pickupAddress, deliveryAddress: form.deliveryAddress,
      deliveryZone: form.deliveryZone, description: form.description, size: form.size,
      declaredValue: parseFloat(form.declaredValue) || 0,
      base, protectionFee, total, isHighValue, status: "searching_rider",
      otpWarehouse: isHighValue ? generateOTP() : null, otpDelivery: isHighValue ? generateOTP() : null,
      otpWarehouseVerified: false, otpDeliveryVerified: false,
      createdAt: new Date().toISOString(),
    };
    setPackages(ps => [pkg, ...ps]);
    addLog(pkg.id, user.id, "customer", user.name, "ORDER_PLACED", pkg.pickupAddress, `Booking confirmed — KES ${pkg.total}`);
    return pkg;
  };

  const onAcceptCollection = (pkgId, riderId) => {
    const rider = accounts.find(r => r.id === riderId);
    updatePkg(pkgId, { riderCollectionId: riderId, status: "picked_up" });
    addLog(pkgId, riderId, "rider", rider?.name, "COLLECTED_FROM_CUSTOMER", packages.find(p => p.id === pkgId)?.pickupAddress, "Package collected");
  };

  const onMarkAtWarehouse = (pkgId, riderId) => {
    const rider = accounts.find(r => r.id === riderId);
    updatePkg(pkgId, { status: "at_warehouse" });
    addLog(pkgId, riderId, "rider", rider?.name, "ARRIVED_AT_WAREHOUSE", "Baruk Central, CBD");
  };

  const onDispatch = (pkgId, riderId) => {
    const rider = accounts.find(r => r.id === riderId);
    updatePkg(pkgId, { riderDeliveryId: riderId, status: "out_for_delivery" });
    addLog(pkgId, "admin-01", "admin", "Admin Hub", "DISPATCHED_TO_RIDER", "Baruk Central, CBD", `Assigned to ${rider?.name}`);
    addLog(pkgId, riderId, "rider", rider?.name, "OUT_FOR_DELIVERY", "Baruk Central, CBD");
  };

  const onAcceptDelivery = (pkgId, riderId) => {
    const rider = accounts.find(r => r.id === riderId);
    updatePkg(pkgId, { riderDeliveryId: riderId });
    addLog(pkgId, riderId, "rider", rider?.name, "ACCEPTED_DELIVERY_JOB", "Baruk Central, CBD");
  };

  const onVerifyOTP = (pkgId, type) => {
    const pkg = packages.find(p => p.id === pkgId);
    if (type === "warehouse") {
      updatePkg(pkgId, { otpWarehouseVerified: true });
      addLog(pkgId, pkg.riderCollectionId, "rider", accounts.find(r => r.id === pkg.riderCollectionId)?.name, "OTP_WAREHOUSE_VERIFIED", "Baruk Central, CBD", "High-value handoff confirmed");
    } else {
      updatePkg(pkgId, { otpDeliveryVerified: true });
      addLog(pkgId, pkg.riderDeliveryId, "rider", accounts.find(r => r.id === pkg.riderDeliveryId)?.name, "OTP_DELIVERY_VERIFIED", pkg.deliveryAddress, "High-value delivery OTP confirmed");
    }
  };

  const onMarkDelivered = (pkgId, riderId) => {
    const rider = accounts.find(r => r.id === riderId);
    const pkg   = packages.find(p => p.id === pkgId);
    updatePkg(pkgId, { status: "delivered" });
    addLog(pkgId, riderId, "rider", rider?.name, "DELIVERED", pkg?.deliveryAddress, "Package delivered successfully");
  };

  // ── Auth screens ──
  if (!user) {
    if (authView === "signup")
      return <SignupScreen onSignup={handleSignup} onBack={() => setAuthView("login")} accounts={accounts} />;
    return <LoginScreen onLogin={handleLogin} onGoSignup={() => setAuthView("signup")} accounts={accounts} />;
  }

  // ── Top bar ──
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

  // ── Riders = accounts with role rider ──
  const riders = accounts.filter(a => a.role === "rider");

  // ── Route by role ──
  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: "#F1F5F9", minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <TopBar />
      {user.role === "customer" && <CustomerApp packages={packages.filter(p => p.customerId === user.id)} onCreatePackage={onCreatePackage} transitLogs={logs} />}
      {user.role === "rider"    && <RiderApp packages={packages} onAcceptCollection={onAcceptCollection} onMarkAtWarehouse={onMarkAtWarehouse} onAcceptDelivery={onAcceptDelivery} onVerifyOTP={onVerifyOTP} onMarkDelivered={onMarkDelivered} transitLogs={logs} currentRider={user} />}
      {user.role === "admin"    && <AdminDashboard packages={packages} riders={riders} transitLogs={logs} onDispatch={onDispatch} onAddRider={handleAddRider} accounts={accounts} />}
    </div>
  );
}