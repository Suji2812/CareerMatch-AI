function StatCard({ label, value, detail }) {
  return (
    <div className="stat-card">
      <p className="eyebrow small">{label}</p>
      <h3>{value}</h3>
      <p>{detail}</p>
    </div>
  )
}

export default StatCard
