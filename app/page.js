"use client";

import mqtt from "mqtt/dist/mqtt.esm.js";import mqtt from "mqtt"; 
import { useEffect, useRef, useState } from "react";

const GROUP = process.env.NEXT_PUBLIC_GROUP_NAME;
const DEVICE_ID = process.env.NEXT_PUBLIC_DEVICE_ID;

const TOPICS = {
  telemetry: `${GROUP}/esp32/${DEVICE_ID}/telemetry`,
  status: `${GROUP}/esp32/${DEVICE_ID}/status`,
  state1: `${GROUP}/esp32/${DEVICE_ID}/state/relay1`,
  state2: `${GROUP}/esp32/${DEVICE_ID}/state/relay2`,
  cmd1: `${GROUP}/esp32/${DEVICE_ID}/commands/relay1`,
  cmd2: `${GROUP}/esp32/${DEVICE_ID}/commands/relay2`,
};

export default function Home() {
  const clientRef = useRef(null);
  const [status, setStatus] = useState("offline");
  const [sensorData, setSensorData] = useState(null);
  const [relay1, setRelay1] = useState("off");
  const [relay2, setRelay2] = useState("off");
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    const client = mqtt.connect(process.env.NEXT_PUBLIC_BROKER_URL, {
      username: process.env.NEXT_PUBLIC_BROKER_USER,
      password: process.env.NEXT_PUBLIC_BROKER_PASS,
    });
    clientRef.current = client;

    client.on("connect", () => {
      client.subscribe([
        TOPICS.telemetry,
        TOPICS.status,
        TOPICS.state1,
        TOPICS.state2,
      ]);
    });

    client.on("message", (topic, payload) => {
      try {
        if (topic === TOPICS.telemetry) {
          setTelemetry(JSON.parse(payload.toString()));
        } else if (topic === TOPICS.status) {
          setStatus(payload.toString());
        } else if (topic === TOPICS.state1) {
          setRelay1(payload.toString());
        } else if (topic === TOPICS.state2) {
          setRelay2(payload.toString());
        }
        setLastUpdate(Date.now());
      } catch (err) {
        console.error("bad payload on", topic, err.message);
      }
    });

    client.on("error", (err) => console.error("mqtt error", err));

    return () => client.end();
  }, []);

  const online = status === "online";

  function setRelay(which, on) {
    if (!online || !clientRef.current) return;
    const topic = which === 1 ? TOPICS.cmd1 : TOPICS.cmd2;
    clientRef.current.publish(topic, on ? "on" : "off");
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
     
        <div style={styles.topBar}>
          <div>
            <h1 style={styles.title}>Sensor Dashboard</h1>
            <p style={styles.subtitle}>Device ID: {DEVICE_ID || "—"}</p>
          </div>
          <StatusBadge online={online} />
        </div>

      
        {!online && (
          <div style={styles.offlineBanner}>
            <span style={styles.offlineIcon}>⚠</span>
            <div>
              <strong>Device is offline</strong>
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
                {lastUpdate
                  ? `Last seen ${formatTime(lastUpdate)}`
                  : "Waiting for first connection..."}
              </div>
            </div>
          </div>
        )}

      
        <Section title="Relay Control">
          <div style={styles.relayGrid}>
            <RelayCard
              label="Relay 1"
              state={relay1}
              online={online}
              onToggle={(v) => setRelay(1, v)}
              accent="#6366F1"
            />
            <RelayCard
              label="Relay 2"
              state={relay2}
              online={online}
              onToggle={(v) => setRelay(2, v)}
              accent="#EC4899"
            />
          </div>
        </Section>

   
        <Section title="Sensor Readings">
          <div style={styles.sensorGrid}>
            <SensorCard
              label="Temperature"
              value={sensorData ? sensorData.temperature : null}
              unit="°C"
              icon="🌡"
              online={online}
            />
            <SensorCard
              label="Altitude"
              value={sensorData ? sensorData.altitude : null}
              unit="m"
              icon="⛰"
              online={online}
            />
          </div>
        </Section>

      
        <div style={styles.footer}>
          <LiveDot online={online} />
          <span>
            {online
              ? `Live stream • updated `
              : "Connection lost • "}
            <SecondsAgo timestamp={lastUpdate} />
          </span>
        </div>
      </div>
    </main>
  );
}



function StatusBadge({ online }) {
  return (
    <div style={styles.badge}>
      <span
        style={{
          ...styles.badgeDot,
          background: online ? "#10B981" : "#6B7280",
          boxShadow: online ? "0 0 8px #10B981" : "none",
        }}
      />
      <span style={{ color: online ? "#10B981" : "#9CA3AF" }}>
        {online ? "Online" : "Offline"}
      </span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <div style={styles.sectionLine} />
        <span style={styles.sectionTitle}>{title}</span>
        <div style={styles.sectionLine} />
      </div>
      {children}
    </div>
  );
}

function RelayCard({ label, state, online, onToggle, accent }) {
  const isOn = state === "on";
  return (
    <div
      style={{
        ...styles.relayCard,
        borderColor: isOn ? accent : "rgba(255,255,255,0.06)",
        boxShadow: isOn ? `0 0 20px ${accent}22` : "none",
      }}
    >
      <div style={styles.relayHeader}>
        <span style={styles.relayLabel}>{label}</span>
        <span
          style={{
            ...styles.relayIndicator,
            background: isOn ? accent : "#374151",
            boxShadow: isOn ? `0 0 6px ${accent}` : "none",
          }}
        />
      </div>

      <button
        disabled={!online}
        onClick={() => onToggle(!isOn)}
        style={{
          ...styles.relayButton,
          background: !online
            ? "#1F2937"
            : isOn
            ? accent
            : "rgba(255,255,255,0.05)",
          color: !online ? "#4B5563" : isOn ? "#fff" : "#D1D5DB",
          borderColor: !online
            ? "#374151"
            : isOn
            ? accent
            : "rgba(255,255,255,0.1)",
          cursor: online ? "pointer" : "not-allowed",
        }}
      >
        {!online ? "Locked" : isOn ? "ACTIVE" : "STANDBY"}
      </button>

      <div style={styles.relayMeta}>
        State: <strong>{online ? (isOn ? "ON" : "OFF") : "—"}</strong>
      </div>
    </div>
  );
}

function SensorCard({ label, value, unit, icon, online }) {
  const display = value !== null && value !== undefined ? `${value}` : "—";
  return (
    <div
      style={{
        ...styles.sensorCard,
        opacity: online ? 1 : 0.35,
      }}
    >
      <div style={styles.sensorIcon}>{icon}</div>
      <div style={styles.sensorValue}>
        {display}
        {value !== null && value !== undefined && (
          <span style={styles.sensorUnit}>{unit}</span>
        )}
      </div>
      <div style={styles.sensorLabel}>{label}</div>
    </div>
  );
}

function LiveDot({ online }) {
  return (
    <span
      style={{
        ...styles.liveDot,
        background: online ? "#10B981" : "#EF4444",
        boxShadow: online ? "0 0 6px #10B981" : "0 0 6px #EF4444",
      }}
    />
  );
}

function SecondsAgo({ timestamp }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!timestamp) return <span>--</span>;
  const secs = Math.floor((now - timestamp) / 1000);
  return <span>{secs}s ago</span>;
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}



const styles = {
  page: {
    minHeight: "100vh",
    background: "#0B0F19",
    color: "#E5E7EB",
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: "40px 20px",
    display: "flex",
    justifyContent: "center",
  },
  container: {
    width: "100%",
    maxWidth: 720,
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: 700,
    margin: 0,
    letterSpacing: -0.5,
    background: "linear-gradient(90deg, #E5E7EB, #9CA3AF)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  subtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  badge: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.06)",
    padding: "6px 14px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 500,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    transition: "all 0.3s ease",
  },
  offlineBanner: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: "rgba(239,68,68,0.08)",
    border: "1px solid rgba(239,68,68,0.15)",
    color: "#FCA5A5",
    padding: "14px 18px",
    borderRadius: 12,
    marginBottom: 24,
    fontSize: 14,
  },
  offlineIcon: {
    fontSize: 18,
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: "#6B7280",
    whiteSpace: "nowrap",
  },
  sectionLine: {
    flex: 1,
    height: 1,
    background: "rgba(255,255,255,0.06)",
  },
  relayGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },
  relayCard: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 20,
    transition: "all 0.3s ease",
  },
  relayHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  relayLabel: {
    fontSize: 14,
    fontWeight: 500,
    color: "#D1D5DB",
  },
  relayIndicator: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    transition: "all 0.3s ease",
  },
  relayButton: {
    width: "100%",
    padding: "10px 0",
    borderRadius: 10,
    border: "1px solid",
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: 0.5,
    transition: "all 0.2s ease",
  },
  relayMeta: {
    marginTop: 10,
    fontSize: 11,
    color: "#6B7280",
    textAlign: "center",
  },
  sensorGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },
  sensorCard: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: "24px 14px",
    textAlign: "center",
    transition: "opacity 0.3s ease",
  },
  sensorIcon: {
    fontSize: 22,
    marginBottom: 8,
  },
  sensorValue: {
    fontSize: 22,
    fontWeight: 700,
    color: "#F3F4F6",
    marginBottom: 4,
  },
  sensorUnit: {
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 2,
    fontWeight: 500,
  },
  sensorLabel: {
    fontSize: 11,
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    fontSize: 12,
    color: "#4B5563",
    paddingTop: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
  },
};