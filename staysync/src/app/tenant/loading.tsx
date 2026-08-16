export default function Loading() {
  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ height: '120px', borderRadius: '16px', background: '#e2e8f0', animation: 'pulse 1.5s infinite ease-in-out' }} />
      <div style={{ height: '80px', borderRadius: '12px', background: '#f1f5f9', animation: 'pulse 1.5s infinite ease-in-out' }} />
      <div style={{ height: '200px', borderRadius: '16px', background: '#e2e8f0', animation: 'pulse 1.5s infinite ease-in-out' }} />
    </div>
  );
}
