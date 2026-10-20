// ============================================================
// SUPABASE SETUP
// ============================================================
import { createClient } from "@supabase/supabase-js";
import { useState, useEffect, useCallback, useRef } from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// HELPERS
// ============================================================
const generateOrderCode = () => "BRK-" + Date.now().toString(36).toUpperCase().slice(-6);

const dbOrderToApp = (o) => ({
  id:              o.id,
  orderCode:       o.order_code,
  customerId:      o.customer_id,
  customerName:    o.customer_name,
  customerPhone:   o.customer_phone,
  customerEmail:   o.customer_email,
  productName:     o.product_name,
  description:     o.description,
  quantity:        o.quantity,
  budgetMin:       o.budget_min,
  budgetMax:       o.budget_max,
  referenceLinks:  o.reference_links,
  sourceCountry:   o.source_country,
  deliveryAddress: o.delivery_address,
  status:          o.status,
  paymentStatus:   o.payment_status,
  productCost:     o.product_cost,
  shippingCost:    o.shipping_cost,
  customsDuty:     o.customs_duty,
  serviceFee:      o.service_fee,
  totalCost:       o.total_cost,
  balanceDue:      o.balance_due,
  depositPaid:     o.deposit_paid,
  mpesaCode:       o.mpesa_code,
  estimatedDays:   o.estimated_days,
  trackingNumber:  o.tracking_number,
  adminNotes:      o.admin_notes,
  createdAt:       o.created_at,
  updatedAt:       o.updated_at,
});

const dbLogToApp = (l) => ({
  id:        l.id,
  orderId:   l.order_id,
  actorName: l.actor_name,
  actorRole: l.actor_role,
  event:     l.event,
  notes:     l.notes,
  createdAt: l.created_at,
});

const STATUS_CONFIG = {
  pending:         { label: "Pending",          color: "#F59E0B", bg: "#FFFBEB", step: 0 },
  quoted:          { label: "Quote Sent",        color: "#3B82F6", bg: "#EFF6FF", step: 1 },
  approved:        { label: "Approved",          color: "#8B5CF6", bg: "#F5F3FF", step: 2 },
  sourcing:        { label: "Sourcing",          color: "#EC4899", bg: "#FDF2F8", step: 3 },
  shipped:         { label: "Shipped",           color: "#06B6D4", bg: "#ECFEFF", step: 4 },
  customs:         { label: "In Customs",        color: "#F97316", bg: "#FFF7ED", step: 5 },
  out_for_delivery:{ label: "Out for Delivery",  color: "#10B981", bg: "#ECFDF5", step: 6 },
  delivered:       { label: "Delivered",         color: "#16A34A", bg: "#F0FDF4", step: 7 },
  cancelled:       { label: "Cancelled",         color: "#6B7280", bg: "#F9FAFB", step: -1 },
};

const STATUS_STEPS = ["pending","quoted","approved","sourcing","shipped","customs","out_for_delivery","delivered"];

const fmt = (n) => n ? `KES ${Number(n).toLocaleString()}` : "—";
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-KE", { day:"numeric", month:"short", year:"numeric" }) : "—";
const fmtTime = (d) => d ? new Date(d).toLocaleString("en-KE", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" }) : "—";

// ============================================================
// SHARED UI
// ============================================================
const Badge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || { label: status, color: "#6B7280", bg: "#F3F4F6" };
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30`, padding: "3px 10px", borderRadius: 20, textTransform: "uppercase", letterSpacing: "0.04em" }}>
      {cfg.label}
    </span>
  );
};

const Card = ({ children, style = {} }) => (
  <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #F0F0F0", boxShadow: "0 1px 6px rgba(0,0,0,0.05)", ...style }}>
    {children}
  </div>
);

const Btn = ({ label, onClick, variant = "primary", small, disabled, style = {} }) => {
  const styles = {
    primary:   { background: "#DC2626", color: "#fff", border: "none" },
    secondary: { background: "#F3F4F6", color: "#374151", border: "none" },
    outline:   { background: "transparent", color: "#DC2626", border: "1.5px solid #DC2626" },
    ghost:     { background: "transparent", color: "#6B7280", border: "1px solid #E5E7EB" },
    green:     { background: "#16A34A", color: "#fff", border: "none" },
    blue:      { background: "#2563EB", color: "#fff", border: "none" },
  };
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ ...styles[variant], padding: small ? "6px 14px" : "10px 20px", borderRadius: 10, fontSize: small ? 12 : 14, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: disabled ? 0.5 : 1, ...style }}>
      {label}
    </button>
  );
};

const Input = ({ label, value, onChange, type = "text", placeholder, small }) => (
  <div style={{ marginBottom: small ? 10 : 16 }}>
    {label && <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>}
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: "100%", padding: small ? "8px 12px" : "11px 14px", border: "1.5px solid #E5E7EB", borderRadius: 9, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none", color: "#111827" }}
      onFocus={e => e.target.style.borderColor = "#DC2626"} onBlur={e => e.target.style.borderColor = "#E5E7EB"} />
  </div>
);

const Textarea = ({ label, value, onChange, placeholder, rows = 3 }) => (
  <div style={{ marginBottom: 16 }}>
    {label && <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>}
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      style={{ width: "100%", padding: "11px 14px", border: "1.5px solid #E5E7EB", borderRadius: 9, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none", resize: "vertical", color: "#111827" }}
      onFocus={e => e.target.style.borderColor = "#DC2626"} onBlur={e => e.target.style.borderColor = "#E5E7EB"} />
  </div>
);

const Select = ({ label, value, onChange, options }) => (
  <div style={{ marginBottom: 16 }}>
    {label && <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>}
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width: "100%", padding: "11px 14px", border: "1.5px solid #E5E7EB", borderRadius: 9, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none", color: "#111827", background: "#fff" }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

// ============================================================
// TIMELINE / LOG
// ============================================================
const LOG_ICONS = {
  REQUEST_SUBMITTED:  "📦",
  QUOTE_SENT:         "💬",
  ORDER_APPROVED:     "✅",
  DEPOSIT_PAID:       "💳",
  STATUS_UPDATED:     "🔄",
  TRACKING_ADDED:     "🚢",
  NOTE_ADDED:         "📝",
};

const Timeline = ({ logs, orderId }) => {
  const orderLogs = logs.filter(l => l.orderId === orderId);
  if (!orderLogs.length) return <div style={{ fontSize: 13, color: "#9CA3AF", textAlign: "center", padding: "20px 0" }}>No activity yet</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {orderLogs.map((log, i) => (
        <div key={log.id} style={{ display: "flex", gap: 12, position: "relative" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#FEF2F2", border: "2px solid #FECACA", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, zIndex: 1 }}>
              {LOG_ICONS[log.event] || "📌"}
            </div>
            {i < orderLogs.length - 1 && <div style={{ width: 2, flex: 1, background: "#F3F4F6", minHeight: 20 }} />}
          </div>
          <div style={{ paddingBottom: 16, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{log.event.replace(/_/g, " ")}</div>
            {log.notes && <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{log.notes}</div>}
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 3 }}>{fmtTime(log.createdAt)} · {log.actorName}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================================
// ORDER PROGRESS BAR
// ============================================================
const ProgressBar = ({ status }) => {
  const step = STATUS_CONFIG[status]?.step ?? 0;
  const total = STATUS_STEPS.length - 1;
  const pct = Math.max(0, (step / total) * 100);
  return (
    <div>
      <div style={{ height: 6, background: "#F3F4F6", borderRadius: 99, overflow: "hidden", marginBottom: 6 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #DC2626, #F97316)", borderRadius: 99, transition: "width 0.5s ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#D1D5DB", fontWeight: 600, textTransform: "uppercase" }}>
        {["Request","Quoted","Approved","Sourcing","Shipped","Customs","Delivery","Done"].map((s, i) => (
          <span key={s} style={{ color: i <= step ? "#DC2626" : "#D1D5DB" }}>{s}</span>
        ))}
      </div>
    </div>
  );
};

// ============================================================
// ORDER DETAIL MODAL (shared)
// ============================================================
const OrderDetail = ({ order, logs, onClose, isAdmin, onSendQuote, onUpdateStatus, onAddNote, onAddTracking, onApproveQuote, onUpdatePayment }) => {
  const [tab, setTab] = useState("details");
  const [quoteForm, setQuoteForm] = useState({
    productCost: "", shippingCost: "", customsDuty: "", serviceFee: "",
    estimatedDays: "", adminNotes: "",
  });
  const [noteText, setNoteText] = useState(order.adminNotes || "");
  const [trackingText, setTrackingText] = useState(order.trackingNumber || "");
  const [mpesaCode, setMpesaCode] = useState("");
  const [newStatus, setNewStatus] = useState(order.status);
  const [loading, setLoading] = useState(false);

  const totalCost = ["productCost","shippingCost","customsDuty","serviceFee"]
    .reduce((s, k) => s + (parseFloat(quoteForm[k]) || 0), 0);

  const handleSendQuote = async () => {
    setLoading(true);
    await onSendQuote(order.id, {
      productCost:   parseFloat(quoteForm.productCost) || 0,
      shippingCost:  parseFloat(quoteForm.shippingCost) || 0,
      customsDuty:   parseFloat(quoteForm.customsDuty) || 0,
      serviceFee:    parseFloat(quoteForm.serviceFee) || 0,
      totalCost,
      balanceDue:    totalCost,
      estimatedDays: quoteForm.estimatedDays,
      adminNotes:    quoteForm.adminNotes,
    });
    setLoading(false);
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 500, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 680, maxHeight: "90dvh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ padding: "16px 20px 0", borderBottom: "1px solid #F3F4F6" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.08em" }}>{order.orderCode}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#111827", marginTop: 2 }}>{order.productName}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
                <Badge status={order.status} />
                <span style={{ fontSize: 12, color: "#9CA3AF" }}>Qty {order.quantity}</span>
                <span style={{ fontSize: 12, color: "#9CA3AF" }}>{fmtDate(order.createdAt)}</span>
              </div>
            </div>
            <button onClick={onClose} style={{ background: "#F3F4F6", border: "none", borderRadius: "50%", width: 32, height: 32, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>
          <div style={{ marginBottom: 12 }}><ProgressBar status={order.status} /></div>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 0, marginBottom: -1 }}>
            {["details","timeline", isAdmin && "admin"].filter(Boolean).map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ padding: "8px 18px", fontSize: 13, fontWeight: 700, background: "none", border: "none", borderBottom: tab === t ? "2.5px solid #DC2626" : "2.5px solid transparent", color: tab === t ? "#DC2626" : "#6B7280", cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          {tab === "details" && (
            <div>
              {/* Cost breakdown if quoted */}
              {order.totalCost && (
                <Card style={{ padding: 16, marginBottom: 16, background: "#F9FAFB" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 10, textTransform: "uppercase" }}>Cost Breakdown</div>
                  {[["Product Cost", order.productCost], ["Shipping", order.shippingCost], ["Customs Duty", order.customsDuty], ["Service Fee", order.serviceFee]].map(([k, v]) => v ? (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#374151", marginBottom: 6 }}>
                      <span>{k}</span><span style={{ fontWeight: 600 }}>{fmt(v)}</span>
                    </div>
                  ) : null)}
                  <div style={{ borderTop: "1.5px solid #E5E7EB", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 900, color: "#111827" }}>
                    <span>Total</span><span>{fmt(order.totalCost)}</span>
                  </div>
                  {order.estimatedDays && <div style={{ fontSize: 12, color: "#6B7280", marginTop: 8 }}>⏱ Estimated delivery: {order.estimatedDays} days</div>}
                </Card>
              )}

              {/* Customer actions */}
              {!isAdmin && order.status === "quoted" && (
                <Card style={{ padding: 16, marginBottom: 16, background: "#EFF6FF", border: "1.5px solid #BFDBFE" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1D40AE", marginBottom: 6 }}>Quote received — approve to proceed</div>
                  <div style={{ fontSize: 12, color: "#3B82F6", marginBottom: 12 }}>Pay full amount via M-Pesa to confirm your order</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Btn label="Approve & Pay" onClick={() => onApproveQuote(order.id)} variant="blue" />
                  </div>
                </Card>
              )}

              {!isAdmin && order.status === "approved" && order.paymentStatus !== "deposit_paid" && (
                <Card style={{ padding: 16, marginBottom: 16, background: "#F0FDF4", border: "1.5px solid #BBF7D0" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#15803D", marginBottom: 6 }}>Send payment via M-Pesa</div>
                  <div style={{ fontSize: 13, color: "#16A34A", marginBottom: 4 }}>Paybill: <strong>522522</strong> · Account: <strong>BARUK{order.orderCode}</strong></div>
                  <div style={{ fontSize: 13, color: "#16A34A", marginBottom: 12 }}>Amount: <strong>{fmt(order.totalCost)}</strong></div>
                  <Input value={mpesaCode} onChange={setMpesaCode} placeholder="Enter M-Pesa confirmation code" />
                  <Btn label="Confirm Payment" onClick={() => { if (mpesaCode) onUpdatePayment(order.id, mpesaCode); }} variant="green" disabled={!mpesaCode} />
                </Card>
              )}

              {/* Order info grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                {[
                  ["Customer", order.customerName],
                  ["Phone", order.customerPhone],
                  ["Source", order.sourceCountry],
                  ["Payment", order.paymentStatus?.replace(/_/g, " ")],
                  ["Budget", order.budgetMin || order.budgetMax ? `${fmt(order.budgetMin)} – ${fmt(order.budgetMax)}` : "Not specified"],
                  ["M-Pesa Code", order.mpesaCode || "—"],
                  ["Tracking #", order.trackingNumber || "—"],
                  ["Delivery To", order.deliveryAddress],
                ].map(([k, v]) => (
                  <div key={k} style={{ background: "#F9FAFB", borderRadius: 10, padding: "10px 14px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", marginBottom: 3 }}>{k}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{v || "—"}</div>
                  </div>
                ))}
              </div>

              {order.description && (
                <div style={{ background: "#F9FAFB", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", marginBottom: 4 }}>Description</div>
                  <div style={{ fontSize: 13, color: "#374151" }}>{order.description}</div>
                </div>
              )}
              {order.referenceLinks && (
                <div style={{ background: "#F9FAFB", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", marginBottom: 4 }}>Reference Links</div>
                  <div style={{ fontSize: 13, color: "#2563EB", wordBreak: "break-all" }}>{order.referenceLinks}</div>
                </div>
              )}
            </div>
          )}

          {tab === "timeline" && <Timeline logs={logs} orderId={order.id} />}

          {tab === "admin" && isAdmin && (
            <div>
              {/* Send Quote */}
              {order.status === "pending" && (
                <Card style={{ padding: 16, marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 14 }}>Send Quote</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <Input label="Product Cost (KES)" value={quoteForm.productCost} onChange={v => setQuoteForm(f => ({ ...f, productCost: v }))} type="number" placeholder="0" small />
                    <Input label="Shipping (KES)" value={quoteForm.shippingCost} onChange={v => setQuoteForm(f => ({ ...f, shippingCost: v }))} type="number" placeholder="0" small />
                    <Input label="Customs Duty (KES)" value={quoteForm.customsDuty} onChange={v => setQuoteForm(f => ({ ...f, customsDuty: v }))} type="number" placeholder="0" small />
                    <Input label="Service Fee (KES)" value={quoteForm.serviceFee} onChange={v => setQuoteForm(f => ({ ...f, serviceFee: v }))} type="number" placeholder="0" small />
                  </div>
                  <Input label="Est. Delivery (days)" value={quoteForm.estimatedDays} onChange={v => setQuoteForm(f => ({ ...f, estimatedDays: v }))} type="number" placeholder="e.g. 21" small />
                  {totalCost > 0 && (
                    <div style={{ background: "#FEF2F2", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 14, fontWeight: 800, color: "#DC2626" }}>
                      Total: KES {totalCost.toLocaleString()}
                    </div>
                  )}
                  <Textarea label="Notes for customer" value={quoteForm.adminNotes} onChange={v => setQuoteForm(f => ({ ...f, adminNotes: v }))} placeholder="Include supplier info, timeline notes, etc." rows={2} />
                  <Btn label={loading ? "Sending…" : "Send Quote"} onClick={handleSendQuote} disabled={!totalCost || loading} />
                </Card>
              )}

              {/* Update Status */}
              <Card style={{ padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 12 }}>Update Status</div>
                <Select value={newStatus} onChange={setNewStatus} options={Object.entries(STATUS_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))} />
                <Btn label="Update" onClick={() => { onUpdateStatus(order.id, newStatus); onClose(); }} variant="primary" />
              </Card>

              {/* Add Tracking */}
              <Card style={{ padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 12 }}>Tracking Number</div>
                <Input value={trackingText} onChange={setTrackingText} placeholder="e.g. SF1234567890CN" small />
                <Btn label="Save Tracking" onClick={() => { onAddTracking(order.id, trackingText); }} variant="ghost" />
              </Card>

              {/* Notes */}
              <Card style={{ padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 12 }}>Internal Notes</div>
                <Textarea value={noteText} onChange={setNoteText} placeholder="Supplier name, negotiation notes, issues…" rows={3} />
                <Btn label="Save Note" onClick={() => { onAddNote(order.id, noteText); }} variant="ghost" />
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// ORDER CARD (list item)
// ============================================================
const OrderCard = ({ order, onClick }) => (
  <Card style={{ padding: 16, cursor: "pointer", transition: "box-shadow 0.15s" }}
    onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.1)"}
    onMouseLeave={e => e.currentTarget.style.boxShadow = "0 1px 6px rgba(0,0,0,0.05)"}
    onClick={onClick}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.05em" }}>{order.orderCode}</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{order.productName}</div>
        <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>Qty {order.quantity} · {order.customerName} · {fmtDate(order.createdAt)}</div>
      </div>
      <Badge status={order.status} />
    </div>
    <ProgressBar status={order.status} />
    {order.totalCost && (
      <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", fontSize: 13 }}>
        <span style={{ color: "#6B7280" }}>Total</span>
        <span style={{ fontWeight: 700, color: "#111827" }}>{fmt(order.totalCost)}</span>
      </div>
    )}
  </Card>
);

// ============================================================
// HOME PAGE
// ============================================================
function HomePage({ onSignup, onLogin }) {
  const A = "https://wa.me/254107129273";
  const ADDRESS_LINE = "HG 66A, Tabere Close, Kileleshwa, Nairobi";
  const MAPS_URL = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("HG 66A, Tabere Close, Kileleshwa, Nairobi, Kenya");
  const SERVICE_PAGES = {
    "Product Sourcing":"/china-sourcing-agent-kenya/", "Sea Freight":"/sea-freight-china-kenya/",
    "Air Freight":"/air-freight-china-kenya/", "Customs Clearance":"/customs-clearance-nairobi/",
    "Last-Mile Delivery":"/china-to-kenya-shipping/",
  };
  const CATEGORY_PAGES = {
    "Motorcycle Parts & Accessories":"/import-auto-motorcycle-parts-china-kenya/",
    "Auto Parts & Accessories":"/import-auto-motorcycle-parts-china-kenya/",
    "Electronics & Gadgets":"/import-electronics-china-kenya/", "Home Appliances":"/import-electronics-china-kenya/",
    "Construction Finishings & Fittings":"/import-construction-materials-china-kenya/",
  };
  const FOOTER_LINKS = {
    "Product Sourcing":"/china-sourcing-agent-kenya/", "Sea Freight":"/sea-freight-china-kenya/", "Air Freight":"/air-freight-china-kenya/",
    "Customs Clearance":"/customs-clearance-nairobi/", "Export Services":"#services",
    "China to Kenya shipping":"/china-to-kenya-shipping/", "Import cost guide":"/guides/cost-of-importing-from-china-to-kenya/",
    "Motorcycle Parts":"/import-auto-motorcycle-parts-china-kenya/", "Construction":"/import-construction-materials-china-kenya/", "Electronics":"/import-electronics-china-kenya/",
    "Auto Parts":"/import-auto-motorcycle-parts-china-kenya/", "All categories":"#categories",
    "About us":"#why", "How it works":"#how", "Track shipment":"#", "Contact":"#contact",
  };

  return (
    <div style={{
      fontFamily: "'DM Sans', system-ui, sans-serif",
      background: "#0A0F1E", color: "#fff",
      overflowX: "hidden", minHeight: "100dvh"
    }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes shipMove { from{left:0%} to{left:calc(100% - 24px)} }
        @keyframes trackFill { from{transform:scaleX(0.2);transform-origin:left} to{transform:scaleX(1);transform-origin:left} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
        .baruk-btn-primary {
          background:#DC2626; color:#fff; border:none; border-radius:10px;
          padding:15px 32px; font-size:15px; font-weight:700; cursor:pointer;
          font-family:inherit; display:inline-block; text-decoration:none;
          box-shadow:0 8px 32px rgba(220,38,38,0.35); transition:all 0.2s;
        }
        .baruk-btn-primary:hover { background:#EF4444; transform:translateY(-2px); box-shadow:0 12px 40px rgba(220,38,38,0.45); }
        .baruk-btn-secondary {
          background:rgba(255,255,255,0.06); color:#fff;
          border:1px solid rgba(255,255,255,0.15); border-radius:10px;
          padding:15px 28px; font-size:15px; font-weight:600; cursor:pointer;
          font-family:inherit; display:inline-block; text-decoration:none; transition:all 0.2s;
        }
        .baruk-btn-secondary:hover { background:rgba(255,255,255,0.12); border-color:rgba(255,255,255,0.3); }
        .baruk-service-card {
          background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08);
          border-radius:20px; padding:32px 28px; transition:all 0.25s; position:relative; overflow:hidden;
        }
        .baruk-service-card:hover { border-color:rgba(220,38,38,0.4); transform:translateY(-4px); box-shadow:0 20px 48px rgba(0,0,0,0.3); }
        .baruk-why-item {
          background:#fff; border-radius:16px; padding:28px 24px;
          border:1px solid #E5E7EB; transition:all 0.2s;
        }
        .baruk-why-item:hover { box-shadow:0 8px 32px rgba(0,0,0,0.08); transform:translateY(-2px); }
        .baruk-category-pill {
          display:flex; align-items:center; gap:8px;
          background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08);
          border-radius:100px; padding:10px 20px; font-size:14px; font-weight:500;
          color:#fff; transition:all 0.2s; cursor:default;
        }
        .baruk-category-pill:hover { background:rgba(220,38,38,0.12); border-color:rgba(220,38,38,0.35); color:#EF4444; }
        .baruk-testimonial {
          background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08);
          border-radius:20px; padding:28px 24px;
        }
        address.baruk-contact-strip { font-style:normal; }
        .baruk-contact-link { color:inherit; text-decoration:none; }
        .baruk-contact-link:hover { text-decoration:underline; }
        @media(max-width:768px){
          .baruk-stats-strip { grid-template-columns:repeat(2,1fr) !important; }
          .baruk-services-grid { grid-template-columns:1fr !important; }
          .baruk-why-grid { grid-template-columns:1fr !important; }
          .baruk-process-grid { grid-template-columns:1fr 1fr !important; }
          .baruk-footer-grid { grid-template-columns:1fr 1fr !important; }
          .baruk-hero-h1 { font-size:42px !important; letter-spacing:-1px !important; }
          .baruk-contact-strip { flex-direction:column !important; align-items:flex-start !important; }
          .baruk-nav-links { display:none !important; }
          .baruk-actions { flex-direction:column !important; }
          .baruk-actions button, .baruk-actions a { width:100%; text-align:center; }
        }
      `}</style>

      {/* ── NAV ── */}
      <header style={{
        position:"sticky", top:0, zIndex:100,
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"0 5%", height:68,
        background:"rgba(10,15,30,0.92)", backdropFilter:"blur(16px)",
        borderBottom:"1px solid rgba(255,255,255,0.07)"
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:38, height:38, borderRadius:10, background:"#DC2626", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:900, color:"#fff" }}>B</div>
          <span style={{ fontSize:20, fontWeight:900, color:"#fff", letterSpacing:"-0.5px" }}>Baruk</span>
          <span style={{ fontSize:11, color:"#DC2626", background:"rgba(220,38,38,0.12)", border:"1px solid rgba(220,38,38,0.25)", borderRadius:20, padding:"2px 10px", fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase" }}>Logistics</span>
        </div>
        <nav aria-label="Main" className="baruk-nav-links" style={{ display:"flex", gap:28, listStyle:"none" }}>
          {[["#services","Services"],["#how","How it works"],["#categories","We source"],["#why","Why us"]].map(([h,l]) => (
            <a key={h} href={h} style={{ color:"#8A96A8", textDecoration:"none", fontSize:14, fontWeight:500, transition:"color 0.2s" }}
              onMouseEnter={e=>e.target.style.color="#fff"} onMouseLeave={e=>e.target.style.color="#8A96A8"}>{l}</a>
          ))}
        </nav>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={onLogin} style={{ padding:"8px 18px", background:"transparent", border:"1px solid rgba(255,255,255,0.18)", borderRadius:9, color:"#fff", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Sign In</button>
          <button onClick={onSignup} className="baruk-btn-primary" style={{ padding:"9px 20px", fontSize:14 }}>Get Started</button>
        </div>
      </header>

      {/* ── HERO ── */}
      <div style={{ minHeight:"calc(100vh - 68px)", display:"flex", flexDirection:"column", justifyContent:"center", padding:"80px 5% 60px", position:"relative", overflow:"hidden" }}>
        {/* bg glow */}
        <div style={{ position:"absolute", inset:0, zIndex:0,
          background:"radial-gradient(ellipse 55% 55% at 70% 50%, rgba(220,38,38,0.13) 0%, transparent 70%), radial-gradient(ellipse 35% 35% at 20% 80%, rgba(220,38,38,0.07) 0%, transparent 60%)" }} />
        {/* grid */}
        <div style={{ position:"absolute", inset:0, zIndex:0,
          backgroundImage:"linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)",
          backgroundSize:"60px 60px",
          WebkitMaskImage:"radial-gradient(ellipse 80% 80% at 50% 50%,black 0%,transparent 100%)" }} />

        <div style={{ position:"relative", zIndex:1, maxWidth:900, animation:"fadeUp 0.7s ease both" }}>
          {/* eyebrow */}
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(220,38,38,0.12)", border:"1px solid rgba(220,38,38,0.3)", borderRadius:100, padding:"6px 16px", marginBottom:28, fontSize:12, fontWeight:600, color:"#EF4444", letterSpacing:"0.08em", textTransform:"uppercase" }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:"#EF4444", animation:"pulse 2s infinite", display:"inline-block" }} />
            Nairobi-based · China & Global Sourcing
          </div>

          <h1 className="baruk-hero-h1" style={{ fontSize:"clamp(44px,7vw,92px)", fontWeight:900, lineHeight:1.0, letterSpacing:"-2px", marginBottom:24 }}>
            Import from China<br/>
            <span style={{ color:"#DC2626" }}>to Kenya.</span><br/>
            <span style={{ WebkitTextStroke:"1.5px rgba(255,255,255,0.2)", color:"transparent" }}>Effortlessly.</span>
          </h1>

          <p style={{ fontSize:"clamp(15px,2vw,19px)", color:"#8A96A8", lineHeight:1.65, maxWidth:540, marginBottom:40 }}>
            We handle imports and exports from China and beyond — sourcing, shipping, customs clearance, and last-mile delivery to your door in Nairobi.
          </p>

          <div className="baruk-actions" style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:56 }}>
            <button onClick={onSignup} className="baruk-btn-primary">📦 Start a Shipment</button>
            <button onClick={onLogin} className="baruk-btn-secondary">Track my order →</button>
          </div>

          {/* Route animation */}
          <div style={{ display:"flex", alignItems:"center", gap:0, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:16, padding:"18px 28px", maxWidth:540, position:"relative" }}>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, minWidth:76 }}>
              <span style={{ fontSize:26 }}>🇨🇳</span>
              <span style={{ fontSize:10, fontWeight:700, color:"#8A96A8", letterSpacing:"0.06em", textTransform:"uppercase" }}>Shanghai</span>
            </div>
            <div style={{ flex:1, height:2, background:"rgba(255,255,255,0.08)", position:"relative", margin:"0 12px", borderRadius:1, overflow:"visible" }}>
              <div style={{ position:"absolute", inset:0, background:"linear-gradient(90deg,#DC2626,#EF4444)", borderRadius:1, animation:"trackFill 3s ease-in-out infinite alternate" }} />
              <span style={{ position:"absolute", top:"50%", transform:"translateY(-50%)", fontSize:18, animation:"shipMove 3s ease-in-out infinite alternate", filter:"drop-shadow(0 0 6px rgba(220,38,38,0.7))" }}>✈️</span>
              <span style={{ position:"absolute", bottom:-20, left:"50%", transform:"translateX(-50%)", fontSize:10, color:"#8A96A8", whiteSpace:"nowrap", fontWeight:500 }}>7–21 days · door to door</span>
            </div>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, minWidth:76 }}>
              <span style={{ fontSize:26 }}>🇰🇪</span>
              <span style={{ fontSize:10, fontWeight:700, color:"#8A96A8", letterSpacing:"0.06em", textTransform:"uppercase" }}>Nairobi</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── STATS ── */}
      <div className="baruk-stats-strip" style={{ background:"#DC2626", padding:"36px 5%", display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:0 }}>
        {[["500+","Shipments completed"],["15+","Product categories"],["98%","On-time delivery"],["48hr","Quote turnaround"]].map(([n,l],i) => (
          <div key={l} style={{ textAlign:"center", padding:"0 20px", borderRight: i < 3 ? "1px solid rgba(255,255,255,0.2)" : "none" }}>
            <div style={{ fontSize:"clamp(26px,3.5vw,44px)", fontWeight:900, color:"#fff", lineHeight:1, marginBottom:4 }}>{n}</div>
            <div style={{ fontSize:13, color:"rgba(255,255,255,0.75)", fontWeight:500 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* ── SERVICES ── */}
      <div id="services" style={{ padding:"88px 5%", background:"#0E1525" }}>
        <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"#DC2626", marginBottom:14 }}>What we do</div>
        <h2 style={{ fontSize:"clamp(28px,4vw,52px)", fontWeight:900, letterSpacing:"-1px", lineHeight:1.1, marginBottom:16 }}>Full-spectrum cargo<br/>logistics</h2>
        <p style={{ fontSize:17, color:"#8A96A8", lineHeight:1.6, maxWidth:500, marginBottom:52 }}>From the factory floor in Guangzhou to your doorstep in Nairobi — we own every step.</p>
        <div className="baruk-services-grid" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:18 }}>
          {[
            ["🌏","Product Sourcing","Tell us what you need. We find verified suppliers, negotiate pricing, and quality-check before shipment. No Alibaba guesswork.","China · India · UAE"],
            ["🚢","Sea Freight","FCL and LCL options for large cargo. We consolidate small orders into shared containers — you only pay for what you use.","FCL · LCL · Groupage"],
            ["✈️","Air Freight","Time-sensitive cargo delivered in 5–10 days. Direct flights, fast customs, competitive rates for urgent shipments.","Express · Standard"],
            ["🏛️","Customs Clearance","We handle IDF, KEBS, KRA, and all documentation. No surprises at the port — your cargo moves smoothly every time.","KRA · KEBS · IDF"],
            ["🏍️","Last-Mile Delivery","From Mombasa port or JKIA straight to your door anywhere in Nairobi. Real-time tracking included.","Nairobi-wide"],
            ["📤","Export Services","Exporting Kenyan goods? We handle packaging, documentation, and freight outbound to any destination.","Africa · Asia · Europe"],
          ].map(([icon,title,desc,tag]) => (
            <div key={title} className="baruk-service-card">
              <span style={{ fontSize:34, marginBottom:18, display:"block" }}>{icon}</span>
              <div style={{ fontSize:19, fontWeight:800, marginBottom:10, letterSpacing:"-0.3px" }}>{title}</div>
              <div style={{ fontSize:14, color:"#8A96A8", lineHeight:1.65 }}>{desc}</div>
              <span style={{ display:"inline-block", marginTop:16, background:"rgba(220,38,38,0.12)", border:"1px solid rgba(220,38,38,0.2)", borderRadius:20, padding:"4px 12px", fontSize:11, fontWeight:700, color:"#EF4444", letterSpacing:"0.04em", textTransform:"uppercase" }}>{tag}</span>
              {SERVICE_PAGES[title] && <a href={SERVICE_PAGES[title]} style={{ display:"block", marginTop:14, color:"#EF4444", fontSize:13, fontWeight:700, textDecoration:"none" }}>Learn more →</a>}
            </div>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <div id="how" style={{ padding:"88px 5%", background:"#F2F4F8" }}>
        <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"#DC2626", marginBottom:14 }}>The process</div>
        <h2 style={{ fontSize:"clamp(28px,4vw,52px)", fontWeight:900, letterSpacing:"-1px", lineHeight:1.1, marginBottom:16, color:"#0A0F1E" }}>Four steps from<br/>request to doorstep</h2>
        <p style={{ fontSize:17, color:"#4B5563", lineHeight:1.6, maxWidth:500, marginBottom:52 }}>We've stripped the complexity out of international cargo.</p>
        <div className="baruk-process-grid" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:0, position:"relative" }}>
          <div style={{ position:"absolute", top:36, left:"10%", right:"10%", height:1, background:"linear-gradient(90deg,transparent,#DC2626,transparent)", opacity:0.25 }} />
          {[
            ["01","Tell us what you need","Share the product, quantity and budget. A reference link or photo helps but isn't required."],
            ["02","Receive a full quote","Within 48 hours you get a complete landed cost — product, freight, duty, and our fee. No hidden charges."],
            ["03","Approve & pay via M-Pesa","Confirm the order and pay through M-Pesa. We begin sourcing and shipping immediately."],
            ["04","Track & receive","Real-time status updates from dispatch to your door. We handle customs — you just wait for the knock."],
          ].map(([n,title,desc]) => (
            <div key={n} style={{ textAlign:"center", padding:"0 20px", position:"relative" }}>
              <div style={{ width:72, height:72, borderRadius:"50%", border:"2px solid #DC2626", background:"rgba(220,38,38,0.08)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, fontWeight:900, color:"#DC2626", margin:"0 auto 20px", position:"relative", zIndex:1 }}>{n}</div>
              <div style={{ fontSize:15, fontWeight:700, marginBottom:8, color:"#0A0F1E" }}>{title}</div>
              <div style={{ fontSize:13, color:"#6B7280", lineHeight:1.6 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CATEGORIES ── */}
      <div id="categories" style={{ padding:"88px 5%", background:"#0E1525" }}>
        <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"#DC2626", marginBottom:14 }}>What we source</div>
        <h2 style={{ fontSize:"clamp(28px,4vw,52px)", fontWeight:900, letterSpacing:"-1px", lineHeight:1.1, marginBottom:16 }}>If it exists,<br/>we can get it.</h2>
        <p style={{ fontSize:17, color:"#8A96A8", lineHeight:1.6, maxWidth:500, marginBottom:48 }}>We source across all categories. Minimum KES 10,000 for individual items.</p>
        <div style={{ display:"flex", flexWrap:"wrap", gap:12 }}>
          {[["🏍️","Motorcycle Parts & Accessories"],["📱","Electronics & Gadgets"],["🚰","Construction Finishings & Fittings"],["🏠","Home Appliances"],["👗","Clothing & Fashion"],["🔧","Tools & Industrial Equipment"],["🎮","Gaming & Entertainment"],["🧴","Beauty & Personal Care"],["🏋️","Fitness & Sports Gear"],["🌱","Agricultural Inputs"],["🚗","Auto Parts & Accessories"],["📦","Custom & Bulk Orders"]].map(([icon,label]) => (
            CATEGORY_PAGES[label]
              ? <a key={label} href={CATEGORY_PAGES[label]} className="baruk-category-pill" style={{ textDecoration:"none", cursor:"pointer" }}><span style={{ fontSize:18 }}>{icon}</span><span>{label}</span></a>
              : <div key={label} className="baruk-category-pill"><span style={{ fontSize:18 }}>{icon}</span><span>{label}</span></div>
          ))}
        </div>
      </div>

      {/* ── WHY BARUK ── */}
      <div id="why" style={{ padding:"88px 5%", background:"#F2F4F8" }}>
        <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"#DC2626", marginBottom:14 }}>Why Baruk</div>
        <h2 style={{ fontSize:"clamp(28px,4vw,52px)", fontWeight:900, letterSpacing:"-1px", lineHeight:1.1, marginBottom:16, color:"#0A0F1E" }}>The sourcing agent<br/>Kenya has been missing</h2>
        <p style={{ fontSize:17, color:"#4B5563", lineHeight:1.6, maxWidth:520, marginBottom:48 }}>We're not a middleman with a WhatsApp number. We're an end-to-end logistics operation built on years of doing this for ourselves first.</p>
        <div className="baruk-why-grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
          {[
            ["🔒","Your money is safe","We only pay suppliers after verification. You get a reference code and real-time tracking from day one. No black holes."],
            ["📊","Full landed cost upfront","Product + freight + customs + our fee — all in one number before you commit. What you approve is what you pay."],
            ["🛃","Customs is our problem","IDF, KEBS, KRA clearance — we've done this hundreds of times. Your cargo doesn't sit at the port while you figure out paperwork."],
            ["🤝","Real supplier relationships","We import regularly for our own retail operations. That means established supplier trust, better prices, and quality checks before anything ships."],
            ["📱","M-Pesa native","Pay in KES via M-Pesa. No USD wire transfers, no forex headaches. We handle currency conversion at competitive rates."],
            ["🚀","48-hour quote turnaround","Send us a request today, have a full landed cost quote by tomorrow. Most agents take a week just to respond."],
          ].map(([icon,title,desc]) => (
            <div key={title} className="baruk-why-item">
              <div style={{ fontSize:26, marginBottom:12 }}>{icon}</div>
              <div style={{ fontSize:16, fontWeight:700, color:"#0A0F1E", marginBottom:6 }}>{title}</div>
              <div style={{ fontSize:14, color:"#6B7280", lineHeight:1.6 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── TESTIMONIALS ── */}
      <div style={{ padding:"88px 5%", background:"#0A0F1E" }}>
        <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"#DC2626", marginBottom:14 }}>What clients say</div>
        <h2 style={{ fontSize:"clamp(28px,4vw,52px)", fontWeight:900, letterSpacing:"-1px", lineHeight:1.1, marginBottom:52 }}>Real shipments.<br/>Real results.</h2>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:20 }}>
          {[
            ["A","Aisha M.","Cleaning Company Owner, Westlands","Baruk sourced sanitary equipment from China, cleared customs, and delivered to my warehouse. Saved me almost 40% vs local suppliers."],
            ["J","James K.","Boda Operator, Langata","Got my motorcycle engine and brake system at almost half the local price. Updated every step of the way. This is how it should work."],
            ["D","David O.","Property Developer, Karen","Sourced taps, showerheads and fittings for an entire apartment block. Quality was exactly as described and customs was completely handled."],
          ].map(([initial,name,role,text]) => (
            <div key={name} className="baruk-testimonial">
              <div style={{ color:"#F59E0B", fontSize:14, marginBottom:14, letterSpacing:2 }}>★★★★★</div>
              <p style={{ fontSize:15, lineHeight:1.65, color:"rgba(255,255,255,0.85)", marginBottom:20, fontStyle:"italic" }}>"{text}"</p>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:40, height:40, borderRadius:"50%", background:"#DC2626", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:900, color:"#fff", flexShrink:0 }}>{initial}</div>
                <div>
                  <div style={{ fontSize:14, fontWeight:700 }}>{name}</div>
                  <div style={{ fontSize:12, color:"#8A96A8" }}>{role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CONTACT STRIP ── */}
      <address id="contact" className="baruk-contact-strip" style={{ background:"#0E1525", borderTop:"1px solid rgba(255,255,255,0.07)", borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"28px 5%", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:20 }}>
        {[
          ["📱","WhatsApp","+254 107 129 273", A],
          ["✉️","Email","info@baruk.co.ke", "mailto:info@baruk.co.ke"],
          ["📍","Visit us",ADDRESS_LINE, MAPS_URL],
          ["⏰","Response time","Within 2 hours", null],
        ].map(([icon,label,val,href]) => (
          <div key={label} style={{ display:"flex", alignItems:"center", gap:12 }}>
            <span style={{ fontSize:22 }}>{icon}</span>
            <div>
              <div style={{ fontSize:11, color:"#8A96A8", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em" }}>{label}</div>
              <div style={{ fontSize:15, fontWeight:700, color:"#fff" }}>
                {href ? <a className="baruk-contact-link" href={href} {...(href.startsWith("http") ? { target:"_blank", rel:"noreferrer" } : {})}>{val}</a> : val}
              </div>
            </div>
          </div>
        ))}
      </address>

      {/* ── CTA ── */}
      <div style={{ background:"#DC2626", padding:"88px 5%", textAlign:"center" }}>
        <h2 style={{ fontSize:"clamp(32px,5vw,64px)", fontWeight:900, color:"#fff", letterSpacing:"-1.5px", marginBottom:16, lineHeight:1.05 }}>Ready to move<br/>your cargo?</h2>
        <p style={{ fontSize:18, color:"rgba(255,255,255,0.8)", marginBottom:40 }}>Tell us what you need. Get a full landed cost quote in 48 hours.</p>
        <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
          <button onClick={onSignup} style={{ background:"#fff", color:"#DC2626", border:"none", borderRadius:10, padding:"15px 36px", fontSize:16, fontWeight:800, cursor:"pointer", fontFamily:"inherit", boxShadow:"0 8px 32px rgba(0,0,0,0.15)", transition:"all 0.2s" }}>
            📦 Start a Shipment
          </button>
          <a href="https://wa.me/254107129273" target="_blank" rel="noreferrer"
            style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(255,255,255,0.15)", border:"1px solid rgba(255,255,255,0.3)", color:"#fff", borderRadius:10, padding:"15px 28px", fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"inherit", textDecoration:"none", transition:"all 0.2s" }}>
            💬 Chat on WhatsApp
          </a>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer style={{ background:"#060911", padding:"56px 5% 28px", borderTop:"1px solid rgba(255,255,255,0.06)" }}>
        <div className="baruk-footer-grid" style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr", gap:40, marginBottom:40 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
              <div style={{ width:36, height:36, borderRadius:10, background:"#DC2626", display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, fontWeight:900, color:"#fff" }}>B</div>
              <span style={{ fontSize:19, fontWeight:900, color:"#fff" }}>Baruk</span>
            </div>
            <p style={{ fontSize:14, color:"#8A96A8", lineHeight:1.7, maxWidth:260 }}>End-to-end import and export logistics for Kenyan businesses and individuals. Source it. Ship it. Delivered.</p>
            <address style={{ fontStyle:"normal", fontSize:14, color:"#8A96A8", lineHeight:1.7, marginTop:14 }}>
              <strong style={{ color:"#fff" }}>Baruk Logistics</strong><br/>
              HG 66A, Tabere Close<br/>
              Kileleshwa, Nairobi, Kenya<br/>
              <a href={MAPS_URL} target="_blank" rel="noreferrer" style={{ color:"#EF4444", textDecoration:"none", fontWeight:600 }}>Get directions →</a>
            </address>
          </div>
          {[
            ["Services",["Product Sourcing","Sea Freight","Air Freight","Customs Clearance","Export Services"]],
            ["We Source",["Motorcycle Parts","Construction","Electronics","Auto Parts","All categories"]],
            ["Company",["About us","How it works","China to Kenya shipping","Import cost guide","Contact"]],
          ].map(([title,links]) => (
            <div key={title}>
              <div style={{ fontSize:12, fontWeight:700, color:"#fff", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:16 }}>{title}</div>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {links.map(l => <a key={l} href={FOOTER_LINKS[l] || "#"} style={{ color:"#8A96A8", textDecoration:"none", fontSize:14, transition:"color 0.2s" }} onMouseEnter={e=>e.target.style.color="#fff"} onMouseLeave={e=>e.target.style.color="#8A96A8"}>{l}</a>)}
              </div>
            </div>
          ))}
        </div>
        <div style={{ borderTop:"1px solid rgba(255,255,255,0.07)", paddingTop:24, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
          <div style={{ fontSize:13, color:"#8A96A8" }}>© {new Date().getFullYear()} Baruk Logistics. All rights reserved.</div>
          <div style={{ display:"flex", gap:8 }}>
            {["KRA Compliant","KEBS Verified","Kileleshwa, Nairobi"].map(b => (
              <span key={b} style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:6, padding:"4px 12px", fontSize:11, color:"#8A96A8", fontWeight:600 }}>{b}</span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

// ============================================================
// CUSTOMER APP
// ============================================================
function CustomerApp({ orders, onCreateOrder, onApproveQuote, onUpdatePayment, logs, currentUser }) {
  const [tab, setTab] = useState("orders");
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [form, setForm] = useState({ productName: "", description: "", quantity: "1", budgetMin: "", budgetMax: "", referenceLinks: "", deliveryAddress: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const set = k => v => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (!form.productName || !form.deliveryAddress) return;
    setLoading(true);
    const result = await onCreateOrder(form);
    setLoading(false);
    if (result) {
      setSuccess("Order submitted! We'll send you a quote within 24 hours.");
      setForm({ productName: "", description: "", quantity: "1", budgetMin: "", budgetMax: "", referenceLinks: "", deliveryAddress: "" });
      setTimeout(() => { setSuccess(""); setShowNewOrder(false); setTab("orders"); }, 3000);
    }
  };

  const pending = orders.filter(o => ["pending","quoted","approved"].includes(o.status));
  const active  = orders.filter(o => ["sourcing","shipped","customs","out_for_delivery"].includes(o.status));
  const done    = orders.filter(o => ["delivered","cancelled"].includes(o.status));

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "20px 16px" }}>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Total Orders", val: orders.length, icon: "📦" },
          { label: "In Transit",   val: active.length,  icon: "🚢" },
          { label: "Delivered",    val: done.filter(o => o.status === "delivered").length, icon: "✅" },
        ].map(s => (
          <div key={s.label} style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", border: "1px solid #F0F0F0", textAlign: "center" }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#111827" }}>{s.val}</div>
            <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* New order button */}
      <button onClick={() => setShowNewOrder(true)}
        style={{ width: "100%", padding: "14px", background: "#DC2626", color: "#fff", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", marginBottom: 20, boxShadow: "0 4px 16px rgba(220,38,38,0.25)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        + New Sourcing Request
      </button>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 16, background: "#F3F4F6", borderRadius: 12, padding: 4 }}>
        {[["orders", "All Orders"], ["active", "In Transit"], ["done", "Done"]].map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)}
            style={{ flex: 1, padding: "8px", fontSize: 13, fontWeight: 700, background: tab === t ? "#fff" : "transparent", border: "none", borderRadius: 9, color: tab === t ? "#111827" : "#6B7280", cursor: "pointer", fontFamily: "inherit", boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s" }}>
            {l} {t === "orders" ? `(${orders.length})` : t === "active" ? `(${active.length})` : `(${done.length})`}
          </button>
        ))}
      </div>

      {/* Order list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {(tab === "orders" ? orders : tab === "active" ? active : done).map(o => (
          <OrderCard key={o.id} order={o} onClick={() => setSelectedOrder(o)} />
        ))}
        {(tab === "orders" ? orders : tab === "active" ? active : done).length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#9CA3AF", fontSize: 14 }}>
            {tab === "orders" ? "No orders yet. Place your first request above!" : "Nothing here yet."}
          </div>
        )}
      </div>

      {/* New order modal */}
      {showNewOrder && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 500, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setShowNewOrder(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 680, maxHeight: "92dvh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "20px 20px 0", borderBottom: "1px solid #F3F4F6", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#111827" }}>New Sourcing Request</div>
                <div style={{ fontSize: 13, color: "#6B7280" }}>Tell us what you need from China</div>
              </div>
              <button onClick={() => setShowNewOrder(false)} style={{ background: "#F3F4F6", border: "none", borderRadius: "50%", width: 32, height: 32, fontSize: 16, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 20px" }}>
              {success && <div style={{ background: "#ECFDF5", border: "1px solid #6EE7B7", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#065F46", fontWeight: 600, marginBottom: 16 }}>✅ {success}</div>}
              <Input label="Product Name *" value={form.productName} onChange={set("productName")} placeholder="e.g. Honda CB400 Exhaust Pipe" />
              <Textarea label="Description" value={form.description} onChange={set("description")} placeholder="Describe the item — specs, color, size, model number, etc." />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <Input label="Quantity *" value={form.quantity} onChange={set("quantity")} type="number" placeholder="1" small />
                <Input label="Budget Min (KES)" value={form.budgetMin} onChange={set("budgetMin")} type="number" placeholder="e.g. 5000" small />
                <Input label="Budget Max (KES)" value={form.budgetMax} onChange={set("budgetMax")} type="number" placeholder="e.g. 15000" small />
              </div>
              <Input label="Reference Links" value={form.referenceLinks} onChange={set("referenceLinks")} placeholder="Alibaba, 1688, or any product URL" />
              <Input label="Delivery Address *" value={form.deliveryAddress} onChange={set("deliveryAddress")} placeholder="e.g. Karen, Nairobi" />
              <div style={{ background: "#FFF7ED", border: "1px solid #FDE68A", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#92400E", marginBottom: 16 }}>
                ⚡ We source from China by default. You'll receive a quote with full landed cost within 24hrs.
              </div>
              <Btn label={loading ? "Submitting…" : "Submit Request"} onClick={handleCreate} disabled={loading || !form.productName || !form.deliveryAddress} style={{ width: "100%" }} />
            </div>
          </div>
        </div>
      )}

      {/* Order detail modal */}
      {selectedOrder && (
        <OrderDetail
          order={selectedOrder}
          logs={logs}
          onClose={() => setSelectedOrder(null)}
          isAdmin={false}
          onApproveQuote={onApproveQuote}
          onUpdatePayment={onUpdatePayment}
        />
      )}
    </div>
  );
}

// ============================================================
// ADMIN DASHBOARD
// ============================================================
function AdminDashboard({ orders, onSendQuote, onUpdateStatus, onAddNote, onAddTracking, customers, logs, currentUser }) {
  const [tab, setTab] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [search, setSearch] = useState("");

  const tabs = [
    { key: "all",      label: "All" },
    { key: "pending",  label: "Pending" },
    { key: "quoted",   label: "Quoted" },
    { key: "approved", label: "Approved" },
    { key: "active",   label: "In Transit" },
    { key: "delivered",label: "Delivered" },
  ];

  const filtered = orders.filter(o => {
    const matchTab = tab === "all" ? true
      : tab === "active" ? ["sourcing","shipped","customs","out_for_delivery"].includes(o.status)
      : o.status === tab;
    const q = search.toLowerCase();
    const matchSearch = !q || o.productName?.toLowerCase().includes(q) || o.customerName?.toLowerCase().includes(q) || o.orderCode?.toLowerCase().includes(q);
    return matchTab && matchSearch;
  });

  // Summary stats
  const totalRevenue = orders.filter(o => o.paymentStatus === "deposit_paid").reduce((s, o) => s + (o.totalCost || 0), 0);
  const pendingCount = orders.filter(o => o.status === "pending").length;
  const activeCount  = orders.filter(o => ["sourcing","shipped","customs","out_for_delivery"].includes(o.status)).length;

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "20px 16px" }}>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Total Orders",   val: orders.length,  icon: "📦", color: "#111827" },
          { label: "Awaiting Quote", val: pendingCount,   icon: "⏳", color: "#D97706" },
          { label: "In Transit",     val: activeCount,    icon: "🚢", color: "#2563EB" },
          { label: "Revenue (paid)", val: `KES ${(totalRevenue/1000).toFixed(0)}K`, icon: "💰", color: "#16A34A" },
        ].map(s => (
          <div key={s.label} style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", border: "1px solid #F0F0F0" }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 16 }}>
        <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14 }}>🔍</span>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search orders, customers, codes…"
          style={{ width: "100%", padding: "11px 14px 11px 40px", border: "1.5px solid #E5E7EB", borderRadius: 12, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none", color: "#111827" }}
          onFocus={e => e.target.style.borderColor = "#DC2626"} onBlur={e => e.target.style.borderColor = "#E5E7EB"} />
      </div>

      {/* Tab nav */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
        {tabs.map(t => {
          const count = t.key === "all" ? orders.length
            : t.key === "active" ? orders.filter(o => ["sourcing","shipped","customs","out_for_delivery"].includes(o.status)).length
            : orders.filter(o => o.status === t.key).length;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ padding: "7px 16px", fontSize: 12, fontWeight: 700, background: tab === t.key ? "#DC2626" : "#F3F4F6", color: tab === t.key ? "#fff" : "#6B7280", border: "none", borderRadius: 20, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0 }}>
              {t.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Order list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.map(o => (
          <OrderCard key={o.id} order={o} onClick={() => setSelectedOrder(o)} />
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#9CA3AF", fontSize: 14 }}>
            {search ? "No orders match your search." : "No orders in this category."}
          </div>
        )}
      </div>

      {/* Order detail modal */}
      {selectedOrder && (
        <OrderDetail
          order={selectedOrder}
          logs={logs}
          onClose={() => setSelectedOrder(null)}
          isAdmin={true}
          onSendQuote={onSendQuote}
          onUpdateStatus={onUpdateStatus}
          onAddNote={onAddNote}
          onAddTracking={onAddTracking}
        />
      )}
    </div>
  );
}
// ============================================================
// AUTH LOGO
// ============================================================
const AuthLogo = () => (
  <div style={{ marginBottom: 28, textAlign: "center" }}>
    <div style={{ width: 64, height: 64, borderRadius: 20, background: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 12px", boxShadow: "0 8px 24px rgba(220,38,38,0.3)" }}>🌐</div>
    <div style={{ fontSize: 32, fontWeight: 900, color: "#DC2626", letterSpacing: "-1px" }}>Baruk</div>
    <div style={{ fontSize: 14, color: "#9CA3AF", marginTop: 4 }}>Source it. Ship it. Delivered.</div>
  </div>
);

const AuthError   = ({ msg }) => msg ? <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#DC2626", fontWeight: 600, marginBottom: 16 }}>⚠️ {msg}</div> : null;
const AuthSuccess = ({ msg }) => msg ? <div style={{ background: "#ECFDF5", border: "1px solid #6EE7B7", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#065F46", fontWeight: 600, marginBottom: 16 }}>✅ {msg}</div> : null;
const AuthBtn     = ({ label, onClick, loading, disabled }) => (
  <button onClick={onClick} disabled={loading || disabled}
    style={{ width: "100%", padding: "13px", background: loading || disabled ? "#FCA5A5" : "#DC2626", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 800, cursor: loading || disabled ? "not-allowed" : "pointer", fontFamily: "inherit", marginTop: 4, boxShadow: "0 2px 12px rgba(220,38,38,0.25)" }}>
    {loading ? "Please wait..." : label}
  </button>
);

const AuthInput = ({ label, value, onChange, type = "text", placeholder, icon }) => (
  <div style={{ marginBottom: 16 }}>
    <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
    <div style={{ position: "relative" }}>
      {icon && <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 15, pointerEvents: "none" }}>{icon}</span>}
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", padding: icon ? "12px 14px 12px 38px" : "12px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none", color: "#111827" }}
        onFocus={e => e.target.style.borderColor = "#DC2626"}
        onBlur={e => e.target.style.borderColor = "#E5E7EB"} />
    </div>
  </div>
);

// ============================================================
// SIGNUP SCREEN
// ============================================================
function SignupScreen({ onBack }) {
  const [form, setForm]       = useState({ name: "", email: "", phone: "", password: "", confirm: "" });
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const set = k => v => setForm(f => ({ ...f, [k]: v }));

  const handleSignup = async () => {
    setError(""); setSuccess("");
    if (!form.name || !form.email || !form.phone || !form.password || !form.confirm) return setError("Please fill in all fields.");
    if (form.password.length < 6) return setError("Password must be at least 6 characters.");
    if (form.password !== form.confirm) return setError("Passwords do not match.");
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signUp({
        email: form.email.trim().toLowerCase(), password: form.password,
        options: { data: { name: form.name.trim(), phone: form.phone.trim(), role: "customer" } },
      });
      if (err) throw err;
      setSuccess("Account created! Signing you in…");
    } catch (err) {
      setError(err.message || "Signup failed. Please try again.");
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100dvh", background: "#F9FAFB", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', system-ui, sans-serif", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <AuthLogo />
        <div style={{ background: "#fff", borderRadius: 20, padding: 28, boxShadow: "0 4px 32px rgba(0,0,0,0.08)" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#111827", marginBottom: 4 }}>Create Account</div>
          <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 24 }}>Free to join. Request anything from China.</div>
          <AuthInput label="Full Name"        value={form.name}     onChange={set("name")}     placeholder="e.g. Amara Osei"      icon="👤" />
          <AuthInput label="Email Address"    value={form.email}    onChange={set("email")}    placeholder="you@example.com"      icon="✉️" type="email" />
          <AuthInput label="Phone Number"     value={form.phone}    onChange={set("phone")}    placeholder="e.g. 0712 345 678"    icon="📞" type="tel" />
          <AuthInput label="Password"         value={form.password} onChange={set("password")} placeholder="Min. 6 characters"    icon="🔒" type="password" />
          <AuthInput label="Confirm Password" value={form.confirm}  onChange={set("confirm")}  placeholder="Repeat your password" icon="🔒" type="password" />
          <AuthError msg={error} /><AuthSuccess msg={success} />
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
function LoginScreen({ onGoSignup, onBack }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleLogin = async () => {
    setError(""); setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (err) throw err;
    } catch { setError("Incorrect email or password. Please try again."); }
    finally { setLoading(false); }
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
              <input type={showPwd ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()} placeholder="••••••••"
                style={{ width: "100%", padding: "12px 44px 12px 38px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none", color: "#111827" }}
                onFocus={e => e.target.style.borderColor = "#DC2626"} onBlur={e => e.target.style.borderColor = "#E5E7EB"} />
              <button onClick={() => setShowPwd(s => !s)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>
                {showPwd ? "🙈" : "👁️"}
              </button>
            </div>
          </div>
          <AuthError msg={error} />
          <AuthBtn label="Sign In" onClick={handleLogin} loading={loading} disabled={!email || !password} />
          <div style={{ textAlign: "center", marginTop: 20, paddingTop: 20, borderTop: "1px solid #F3F4F6" }}>
            <span style={{ fontSize: 14, color: "#6B7280" }}>New here? </span>
            <button onClick={onGoSignup} style={{ fontSize: 14, color: "#DC2626", fontWeight: 700, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Create a free account →</button>
          </div>
          {onBack && (
            <div style={{ textAlign: "center", marginTop: 10 }}>
              <button onClick={onBack} style={{ fontSize: 13, color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>← Back to home</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// LOADING SCREEN
// ============================================================
const LoadingScreen = () => (
  <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F9FAFB", flexDirection: "column", gap: 16, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
    <div style={{ width: 64, height: 64, borderRadius: 20, background: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, boxShadow: "0 8px 24px rgba(220,38,38,0.3)" }}>🌐</div>
    <div style={{ fontSize: 24, fontWeight: 900, color: "#DC2626" }}>Baruk</div>
    <div style={{ width: 32, height: 32, border: "3px solid #FECACA", borderTopColor: "#DC2626", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

// ============================================================
// PWA INSTALL BANNER
// ============================================================
function InstallBanner() {
  const [show, setShow]   = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    if (isStandalone || sessionStorage.getItem("install-dismissed")) return;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);
    if (ios) { setTimeout(() => setShow(true), 3000); }
    else {
      const handler = e => { e.preventDefault(); setDeferredPrompt(e); setTimeout(() => setShow(true), 3000); };
      window.addEventListener("beforeinstallprompt", handler);
      return () => window.removeEventListener("beforeinstallprompt", handler);
    }
  }, []);

  const dismiss = () => { setShow(false); sessionStorage.setItem("install-dismissed", "1"); };

  if (!show) return null;
  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999, background: "#fff", borderTop: "2px solid #FECACA", boxShadow: "0 -4px 24px rgba(0,0,0,0.12)", padding: "16px 20px", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>🌐</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: "#111827", marginBottom: 2 }}>Install Baruk App</div>
          {isIOS
            ? <div style={{ fontSize: 13, color: "#6B7280" }}>Tap <strong>Share ⎋</strong> then <strong>"Add to Home Screen"</strong></div>
            : <div style={{ fontSize: 13, color: "#6B7280" }}>Get quick access — works offline, opens instantly</div>}
          {!isIOS && deferredPrompt && (
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button onClick={async () => { deferredPrompt.prompt(); await deferredPrompt.userChoice; dismiss(); }}
                style={{ background: "#DC2626", color: "#fff", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>Install</button>
              <button onClick={dismiss} style={{ background: "#F3F4F6", color: "#6B7280", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Not now</button>
            </div>
          )}
        </div>
        <button onClick={dismiss} style={{ background: "none", border: "none", fontSize: 20, color: "#9CA3AF", cursor: "pointer" }}>✕</button>
      </div>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [user, setUser]             = useState(null);
  const [authView, setAuthView]     = useState(() => {
    const q = new URLSearchParams(window.location.search);
    return q.has("signup") ? "signup" : q.has("login") ? "login" : "home";
  });
  const [appLoading, setAppLoading] = useState(true);
  const [orders, setOrders]         = useState([]);
  const [logs, setLogs]             = useState([]);
  const [customers, setCustomers]   = useState([]);
  const realtimeRef                 = useRef(null);

  const profileToUser = (authUser, profile) => ({
    id:    authUser.id,
    email: authUser.email,
    name:  profile.name,
    phone: profile.phone,
    role:  profile.role,
  });

  const loadProfile = useCallback(async (authUser) => {
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", authUser.id).single();
    if (profile) setUser(profileToUser(authUser, profile));
  }, []);

  const loadOrders = useCallback(async () => {
    const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    if (error) { console.error("[loadOrders]", error); return; }
    if (data) setOrders(data.map(dbOrderToApp));
  }, []);

  const loadLogs = useCallback(async () => {
    const { data } = await supabase.from("order_logs").select("*").order("created_at", { ascending: true });
    if (data) setLogs(data.map(dbLogToApp));
  }, []);

  const loadCustomers = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("*").eq("role", "customer");
    if (data) setCustomers(data.map(p => ({ id: p.id, name: p.name, phone: p.phone, email: p.email, role: "customer", createdAt: p.created_at })));
  }, []);

  const addLog = async (orderId, actorName, actorRole, event, notes = "") => {
    await supabase.from("order_logs").insert({ order_id: orderId, actor_name: actorName, actor_role: actorRole, event, notes });
    await loadLogs();
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) loadProfile(session.user);
      setAppLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) { loadProfile(session.user); }
      else { setUser(null); setOrders([]); setLogs([]); }
    });
    return () => subscription.unsubscribe();
  }, [loadProfile]);

  useEffect(() => {
    if (!user) return;
    loadOrders(); loadLogs(); if (user.role === "admin") loadCustomers();
    if (realtimeRef.current) supabase.removeChannel(realtimeRef.current);
    const channel = supabase.channel("sourcing-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" },     () => loadOrders())
      .on("postgres_changes", { event: "*", schema: "public", table: "order_logs" }, () => loadLogs())
      .subscribe();
    realtimeRef.current = channel;
    return () => supabase.removeChannel(channel);
  }, [user, loadOrders, loadLogs, loadCustomers]);

  const onCreateOrder = async (form) => {
    const orderCode = generateOrderCode();
    const { data, error } = await supabase.from("orders").insert({
      order_code:       orderCode,
      customer_id:      user.id,
      customer_name:    user.name,
      customer_phone:   user.phone,
      customer_email:   user.email,
      product_name:     form.productName,
      description:      form.description,
      quantity:         parseInt(form.quantity) || 1,
      budget_min:       parseFloat(form.budgetMin) || null,
      budget_max:       parseFloat(form.budgetMax) || null,
      reference_links:  form.referenceLinks || null,
      source_country:   "China",
      delivery_address: form.deliveryAddress,
      status:           "pending",
      payment_status:   "unpaid",
    }).select().single();
    if (error) { console.error("[onCreateOrder]", error); return null; }
    await addLog(data.id, user.name, "customer", "REQUEST_SUBMITTED", `${form.productName} — Qty ${form.quantity}`);
    return dbOrderToApp(data);
  };

  const onSendQuote = async (orderId, quoteData) => {
    const { error } = await supabase.from("orders").update({
      product_cost:   quoteData.productCost,
      shipping_cost:  quoteData.shippingCost,
      customs_duty:   quoteData.customsDuty,
      service_fee:    quoteData.serviceFee,
      total_cost:     quoteData.totalCost,
      balance_due:    quoteData.balanceDue,
      estimated_days: quoteData.estimatedDays,
      admin_notes:    quoteData.adminNotes,
      status:         "quoted",
    }).eq("id", orderId);
    if (error) { console.error("[onSendQuote]", error); return; }
    await addLog(orderId, user.name, "admin", "QUOTE_SENT", `Total KES ${quoteData.totalCost.toLocaleString()} — Est. ${quoteData.estimatedDays || "?"} days`);
    await loadOrders();
  };

  const onApproveQuote = async (orderId) => {
    await supabase.from("orders").update({ status: "approved" }).eq("id", orderId);
    await addLog(orderId, user.name, "customer", "ORDER_APPROVED", "Customer approved quote and paid deposit");
    await loadOrders();
  };

  const onUpdatePayment = async (orderId, mpesaCode) => {
    const order = orders.find(o => o.id === orderId);
    const depositAmount = order?.totalCost || 0;
    await supabase.from("orders").update({
      payment_status: "deposit_paid",
      mpesa_code:     mpesaCode,
      deposit_paid:   depositAmount,
      balance_due:    0,
    }).eq("id", orderId);
    await addLog(orderId, user.name, "customer", "DEPOSIT_PAID", `M-Pesa code: ${mpesaCode} — KES ${depositAmount.toLocaleString()}`);
    await loadOrders();
  };

  const onUpdateStatus = async (orderId, newStatus) => {
    await supabase.from("orders").update({ status: newStatus }).eq("id", orderId);
    await addLog(orderId, user.name, "admin", "STATUS_UPDATED", `Status changed to: ${newStatus.replace(/_/g, " ")}`);
    await loadOrders();
  };

  const onAddNote = async (orderId, note) => {
    await supabase.from("orders").update({ admin_notes: note }).eq("id", orderId);
    await addLog(orderId, user.name, "admin", "NOTE_ADDED", note);
    await loadOrders();
  };

  const onAddTracking = async (orderId, trackingNumber) => {
    await supabase.from("orders").update({ tracking_number: trackingNumber }).eq("id", orderId);
    await addLog(orderId, user.name, "admin", "TRACKING_ADDED", `Tracking number: ${trackingNumber}`);
    await loadOrders();
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); setUser(null); };

  if (appLoading) return <LoadingScreen />;

  if (!user) {
    if (authView === "signup") return <><SignupScreen onBack={() => setAuthView("login")} /><InstallBanner /></>;
    if (authView === "login")  return <><LoginScreen onGoSignup={() => setAuthView("signup")} onBack={() => setAuthView("home")} /><InstallBanner /></>;
    return <><HomePage onSignup={() => setAuthView("signup")} onLogin={() => setAuthView("login")} /><InstallBanner /></>;
  }

  const myOrders = user.role === "admin" ? orders : orders.filter(o => o.customerId === user.id);

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", minHeight: "100dvh", background: "#F9FAFB" }}>
      <div style={{ background: "#111827", padding: "10px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>🌐</div>
          <span style={{ fontSize: 16, fontWeight: 900, color: "#fff", letterSpacing: "-0.5px" }}>Baruk</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 13, color: "#9CA3AF" }}>{user.name}</div>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#DC2626", background: "rgba(220,38,38,0.15)", padding: "2px 8px", borderRadius: 20, textTransform: "uppercase" }}>{user.role}</span>
          <button onClick={handleSignOut} style={{ fontSize: 12, color: "#6B7280", background: "none", border: "1px solid #374151", borderRadius: 8, padding: "4px 12px", cursor: "pointer", fontFamily: "inherit" }}>Sign Out</button>
        </div>
      </div>

      {user.role === "admin"
        ? <AdminDashboard orders={orders} onSendQuote={onSendQuote} onUpdateStatus={onUpdateStatus} onAddNote={onAddNote} onAddTracking={onAddTracking} customers={customers} logs={logs} currentUser={user} />
        : <CustomerApp orders={myOrders} onCreateOrder={onCreateOrder} onApproveQuote={onApproveQuote} onUpdatePayment={onUpdatePayment} logs={logs} currentUser={user} />
      }
      <InstallBanner />
    </div>
  );
}
