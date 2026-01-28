import React, { useState, useMemo } from 'react';

// MACRS depreciation rates
const MACRS_RATES = {
  5: [0.2, 0.32, 0.192, 0.1152, 0.1152, 0.0576],
  7: [0.1429, 0.2449, 0.1749, 0.1249, 0.0893, 0.0892, 0.0893, 0.0446],
  15: [0.05, 0.095, 0.0855, 0.077, 0.0693, 0.0623, 0.059, 0.059, 0.0591, 0.059, 0.0591, 0.059, 0.0591, 0.059, 0.0591, 0.0295],
  27.5: Array(28).fill(null).map((_, i) => i === 0 ? 0.03636 : i === 27 ? 0.01515 : 0.03636),
  39: Array(40).fill(null).map((_, i) => i === 0 ? 0.02461 : i === 39 ? 0.00107 : 0.02564)
};

// Bonus depreciation rates by year placed in service
const BONUS_RATES = {
  2022: 1.00,
  2023: 0.80,
  2024: 0.60,
  2025: 0.40,
  2026: 0.20,
  2027: 0.00
};

const ASSET_CATEGORIES = [
  { id: 'land', name: 'Land (Non-Depreciable)', life: 0, description: 'Raw land value - not depreciable', color: '#6b7280' },
  { id: '5year', name: '5-Year Property', life: 5, description: 'Appliances, carpeting, certain equipment', color: '#10b981' },
  { id: '7year', name: '7-Year Property', life: 7, description: 'Furniture, fixtures, office equipment', color: '#3b82f6' },
  { id: '15year', name: '15-Year Property', life: 15, description: 'Land improvements, landscaping, parking lots', color: '#8b5cf6' },
  { id: 'residential', name: 'Residential (27.5 yr)', life: 27.5, description: 'Residential rental property structures', color: '#f59e0b' },
  { id: 'commercial', name: 'Commercial (39 yr)', life: 39, description: 'Nonresidential real property', color: '#ef4444' }
];

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function formatPercent(value) {
  return (value * 100).toFixed(1) + '%';
}

export default function DepreciationCalculator() {
  const [propertyName, setPropertyName] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('2024-01-01');
  const [totalCost, setTotalCost] = useState(1000000);
  const [allocations, setAllocations] = useState({
    land: 15,
    '5year': 8,
    '7year': 5,
    '15year': 12,
    residential: 0,
    commercial: 60
  });
  const [propertyType, setPropertyType] = useState('commercial');
  const [useBonus, setUseBonus] = useState(true);
  const [useSection179, setUseSection179] = useState(false);
  const [section179Amount, setSection179Amount] = useState(0);
  const [depreciationMethod, setDepreciationMethod] = useState('macrs');
  const [activeTab, setActiveTab] = useState('input');

  const purchaseYear = new Date(purchaseDate).getFullYear();
  const bonusRate = BONUS_RATES[purchaseYear] || 0;

  const updateAllocation = (id, value) => {
    const newValue = Math.max(0, Math.min(100, parseFloat(value) || 0));
    setAllocations(prev => ({ ...prev, [id]: newValue }));
  };

  const totalAllocation = Object.values(allocations).reduce((sum, val) => sum + val, 0);

  const scheduleData = useMemo(() => {
    const years = 40;
    const schedule = [];
    const categorySchedules = {};

    ASSET_CATEGORIES.forEach(cat => {
      categorySchedules[cat.id] = {
        basis: (allocations[cat.id] / 100) * totalCost,
        yearlyDepreciation: [],
        cumulative: 0
      };
    });

    // Apply Section 179 first (only to eligible property: 5, 7, 15 year)
    let remaining179 = useSection179 ? section179Amount : 0;
    const eligible179 = ['5year', '7year', '15year'];
    
    eligible179.forEach(catId => {
      if (remaining179 > 0) {
        const catBasis = categorySchedules[catId].basis;
        const deduction = Math.min(remaining179, catBasis);
        categorySchedules[catId].section179 = deduction;
        categorySchedules[catId].basis -= deduction;
        remaining179 -= deduction;
      }
    });

    // Apply Bonus Depreciation (to eligible property after Section 179)
    const eligibleBonus = ['5year', '7year', '15year'];
    eligibleBonus.forEach(catId => {
      if (useBonus && bonusRate > 0) {
        const bonus = categorySchedules[catId].basis * bonusRate;
        categorySchedules[catId].bonusDepreciation = bonus;
        categorySchedules[catId].basis -= bonus;
      }
    });

    // Calculate yearly depreciation
    for (let year = 0; year < years; year++) {
      const yearData = {
        year: purchaseYear + year,
        depreciation: {},
        totalDepreciation: 0
      };

      ASSET_CATEGORIES.forEach(cat => {
        if (cat.life === 0) {
          yearData.depreciation[cat.id] = 0;
          return;
        }

        const catData = categorySchedules[cat.id];
        let yearDepreciation = 0;

        if (depreciationMethod === 'macrs') {
          const rates = MACRS_RATES[cat.life];
          if (rates && year < rates.length) {
            yearDepreciation = catData.basis * rates[year];
          }
        } else {
          // Straight-line
          const life = cat.life;
          if (year < life) {
            yearDepreciation = catData.basis / life;
          }
        }

        // Add first-year special deductions
        if (year === 0) {
          yearDepreciation += (catData.section179 || 0) + (catData.bonusDepreciation || 0);
        }

        catData.yearlyDepreciation.push(yearDepreciation);
        catData.cumulative += yearDepreciation;
        yearData.depreciation[cat.id] = yearDepreciation;
        yearData.totalDepreciation += yearDepreciation;
      });

      schedule.push(yearData);
    }

    return { schedule, categorySchedules };
  }, [allocations, totalCost, purchaseYear, useBonus, bonusRate, useSection179, section179Amount, depreciationMethod]);

  const summaryStats = useMemo(() => {
    const firstYearTotal = scheduleData.schedule[0]?.totalDepreciation || 0;
    const fiveYearTotal = scheduleData.schedule.slice(0, 5).reduce((sum, y) => sum + y.totalDepreciation, 0);
    const tenYearTotal = scheduleData.schedule.slice(0, 10).reduce((sum, y) => sum + y.totalDepreciation, 0);
    const totalDepreciable = totalCost - (allocations.land / 100) * totalCost;
    
    return { firstYearTotal, fiveYearTotal, tenYearTotal, totalDepreciable };
  }, [scheduleData, totalCost, allocations.land]);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
      color: '#e2e8f0',
      padding: '24px'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(90deg, rgba(16,185,129,0.1) 0%, rgba(59,130,246,0.1) 100%)',
        border: '1px solid rgba(16,185,129,0.3)',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            background: 'linear-gradient(135deg, #10b981, #3b82f6)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px'
          }}>📊</div>
          <div>
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '700', letterSpacing: '-0.5px' }}>
              Depreciation & Cost Segregation Calculator
            </h1>
            <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: '14px' }}>
              MACRS • Bonus Depreciation • Section 179 • Cost Segregation Analysis
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {[
          { id: 'input', label: '📝 Property Setup' },
          { id: 'allocation', label: '🎯 Cost Segregation' },
          { id: 'schedule', label: '📅 Depreciation Schedule' },
          { id: 'summary', label: '📈 Summary' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 20px',
              background: activeTab === tab.id 
                ? 'linear-gradient(135deg, #10b981, #059669)' 
                : 'rgba(30,41,59,0.8)',
              border: activeTab === tab.id 
                ? '1px solid #10b981' 
                : '1px solid rgba(71,85,105,0.5)',
              borderRadius: '8px',
              color: activeTab === tab.id ? '#fff' : '#94a3b8',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              fontFamily: 'inherit',
              transition: 'all 0.2s ease'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Input Tab */}
      {activeTab === 'input' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '24px'
        }}>
          {/* Property Details */}
          <div style={{
            background: 'rgba(30,41,59,0.6)',
            border: '1px solid rgba(71,85,105,0.5)',
            borderRadius: '12px',
            padding: '24px'
          }}>
            <h2 style={{ margin: '0 0 20px', fontSize: '18px', color: '#10b981' }}>Property Details</h2>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Property Name
              </label>
              <input
                type="text"
                value={propertyName}
                onChange={(e) => setPropertyName(e.target.value)}
                placeholder="e.g., 123 Main Street Office Building"
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'rgba(15,23,42,0.8)',
                  border: '1px solid rgba(71,85,105,0.5)',
                  borderRadius: '8px',
                  color: '#e2e8f0',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Purchase / Placed in Service Date
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'rgba(15,23,42,0.8)',
                  border: '1px solid rgba(71,85,105,0.5)',
                  borderRadius: '8px',
                  color: '#e2e8f0',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Total Property Cost
              </label>
              <input
                type="number"
                value={totalCost}
                onChange={(e) => setTotalCost(parseFloat(e.target.value) || 0)}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'rgba(15,23,42,0.8)',
                  border: '1px solid rgba(71,85,105,0.5)',
                  borderRadius: '8px',
                  color: '#e2e8f0',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box'
                }}
              />
              <div style={{ marginTop: '8px', color: '#64748b', fontSize: '12px' }}>
                Formatted: {formatCurrency(totalCost)}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Property Type
              </label>
              <select
                value={propertyType}
                onChange={(e) => {
                  setPropertyType(e.target.value);
                  if (e.target.value === 'residential') {
                    setAllocations(prev => ({ ...prev, commercial: 0, residential: prev.commercial + prev.residential }));
                  } else {
                    setAllocations(prev => ({ ...prev, residential: 0, commercial: prev.commercial + prev.residential }));
                  }
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'rgba(15,23,42,0.8)',
                  border: '1px solid rgba(71,85,105,0.5)',
                  borderRadius: '8px',
                  color: '#e2e8f0',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box'
                }}
              >
                <option value="commercial">Commercial (39-year)</option>
                <option value="residential">Residential Rental (27.5-year)</option>
              </select>
            </div>
          </div>

          {/* Depreciation Options */}
          <div style={{
            background: 'rgba(30,41,59,0.6)',
            border: '1px solid rgba(71,85,105,0.5)',
            borderRadius: '12px',
            padding: '24px'
          }}>
            <h2 style={{ margin: '0 0 20px', fontSize: '18px', color: '#3b82f6' }}>Depreciation Options</h2>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Depreciation Method
              </label>
              <select
                value={depreciationMethod}
                onChange={(e) => setDepreciationMethod(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'rgba(15,23,42,0.8)',
                  border: '1px solid rgba(71,85,105,0.5)',
                  borderRadius: '8px',
                  color: '#e2e8f0',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box'
                }}
              >
                <option value="macrs">MACRS (Recommended)</option>
                <option value="straight">Straight-Line</option>
              </select>
            </div>

            <div style={{
              padding: '16px',
              background: 'rgba(59,130,246,0.1)',
              border: '1px solid rgba(59,130,246,0.3)',
              borderRadius: '8px',
              marginBottom: '16px'
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={useBonus}
                  onChange={(e) => setUseBonus(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#3b82f6' }}
                />
                <div>
                  <div style={{ fontWeight: '600', marginBottom: '4px' }}>Bonus Depreciation</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    {purchaseYear} rate: {formatPercent(bonusRate)} (applies to 5, 7, 15-year property)
                  </div>
                </div>
              </label>
            </div>

            <div style={{
              padding: '16px',
              background: 'rgba(139,92,246,0.1)',
              border: '1px solid rgba(139,92,246,0.3)',
              borderRadius: '8px'
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginBottom: '12px' }}>
                <input
                  type="checkbox"
                  checked={useSection179}
                  onChange={(e) => setUseSection179(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#8b5cf6' }}
                />
                <div>
                  <div style={{ fontWeight: '600', marginBottom: '4px' }}>Section 179 Deduction</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Immediate expense election (2024 limit: $1,160,000)
                  </div>
                </div>
              </label>
              {useSection179 && (
                <input
                  type="number"
                  value={section179Amount}
                  onChange={(e) => setSection179Amount(parseFloat(e.target.value) || 0)}
                  placeholder="Enter Section 179 amount"
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: 'rgba(15,23,42,0.8)',
                    border: '1px solid rgba(71,85,105,0.5)',
                    borderRadius: '6px',
                    color: '#e2e8f0',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box'
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cost Segregation Tab */}
      {activeTab === 'allocation' && (
        <div style={{
          background: 'rgba(30,41,59,0.6)',
          border: '1px solid rgba(71,85,105,0.5)',
          borderRadius: '12px',
          padding: '24px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2 style={{ margin: 0, fontSize: '18px', color: '#10b981' }}>Cost Segregation Allocation</h2>
            <div style={{
              padding: '8px 16px',
              background: totalAllocation === 100 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
              border: `1px solid ${totalAllocation === 100 ? '#10b981' : '#ef4444'}`,
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '600',
              color: totalAllocation === 100 ? '#10b981' : '#ef4444'
            }}>
              Total: {totalAllocation.toFixed(1)}%
            </div>
          </div>

          <div style={{ display: 'grid', gap: '16px' }}>
            {ASSET_CATEGORIES.map(cat => {
              const isDisabled = (cat.id === 'residential' && propertyType === 'commercial') ||
                                (cat.id === 'commercial' && propertyType === 'residential');
              const amount = (allocations[cat.id] / 100) * totalCost;
              
              return (
                <div
                  key={cat.id}
                  style={{
                    padding: '16px',
                    background: isDisabled ? 'rgba(15,23,42,0.3)' : 'rgba(15,23,42,0.6)',
                    border: `1px solid ${cat.color}40`,
                    borderLeft: `4px solid ${cat.color}`,
                    borderRadius: '8px',
                    opacity: isDisabled ? 0.5 : 1
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontWeight: '600', color: cat.color, marginBottom: '4px' }}>{cat.name}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{cat.description}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '18px', fontWeight: '700', color: '#e2e8f0' }}>
                        {formatCurrency(amount)}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.5"
                      value={allocations[cat.id]}
                      onChange={(e) => updateAllocation(cat.id, e.target.value)}
                      disabled={isDisabled}
                      style={{
                        flex: 1,
                        height: '8px',
                        accentColor: cat.color,
                        cursor: isDisabled ? 'not-allowed' : 'pointer'
                      }}
                    />
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={allocations[cat.id]}
                      onChange={(e) => updateAllocation(cat.id, e.target.value)}
                      disabled={isDisabled}
                      style={{
                        width: '80px',
                        padding: '8px',
                        background: 'rgba(15,23,42,0.8)',
                        border: '1px solid rgba(71,85,105,0.5)',
                        borderRadius: '6px',
                        color: '#e2e8f0',
                        fontSize: '14px',
                        fontFamily: 'inherit',
                        textAlign: 'center'
                      }}
                    />
                    <span style={{ color: '#64748b', width: '20px' }}>%</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Visual Breakdown */}
          <div style={{ marginTop: '24px' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Visual Breakdown
            </div>
            <div style={{ display: 'flex', height: '40px', borderRadius: '8px', overflow: 'hidden' }}>
              {ASSET_CATEGORIES.filter(cat => allocations[cat.id] > 0).map(cat => (
                <div
                  key={cat.id}
                  style={{
                    width: `${allocations[cat.id]}%`,
                    background: cat.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#fff',
                    minWidth: allocations[cat.id] > 5 ? 'auto' : '0'
                  }}
                  title={`${cat.name}: ${allocations[cat.id]}%`}
                >
                  {allocations[cat.id] >= 8 && `${allocations[cat.id]}%`}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '12px' }}>
              {ASSET_CATEGORIES.filter(cat => allocations[cat.id] > 0).map(cat => (
                <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                  <div style={{ width: '12px', height: '12px', background: cat.color, borderRadius: '2px' }} />
                  <span style={{ color: '#94a3b8' }}>{cat.name.split(' ')[0]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Schedule Tab */}
      {activeTab === 'schedule' && (
        <div style={{
          background: 'rgba(30,41,59,0.6)',
          border: '1px solid rgba(71,85,105,0.5)',
          borderRadius: '12px',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(71,85,105,0.5)' }}>
            <h2 style={{ margin: 0, fontSize: '18px', color: '#f59e0b' }}>Year-by-Year Depreciation Schedule</h2>
          </div>
          
          <div style={{ overflowX: 'auto', maxHeight: '600px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#1e293b' }}>
                <tr>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#94a3b8', fontWeight: '600', borderBottom: '1px solid rgba(71,85,105,0.5)' }}>Year</th>
                  {ASSET_CATEGORIES.filter(cat => allocations[cat.id] > 0 && cat.life > 0).map(cat => (
                    <th key={cat.id} style={{ padding: '12px 16px', textAlign: 'right', color: cat.color, fontWeight: '600', borderBottom: '1px solid rgba(71,85,105,0.5)' }}>
                      {cat.name.split(' ')[0]}
                    </th>
                  ))}
                  <th style={{ padding: '12px 16px', textAlign: 'right', color: '#10b981', fontWeight: '600', borderBottom: '1px solid rgba(71,85,105,0.5)' }}>Total</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b', fontWeight: '600', borderBottom: '1px solid rgba(71,85,105,0.5)' }}>Cumulative</th>
                </tr>
              </thead>
              <tbody>
                {scheduleData.schedule.filter((_, i) => i < 40).map((yearData, index) => {
                  const cumulative = scheduleData.schedule.slice(0, index + 1).reduce((sum, y) => sum + y.totalDepreciation, 0);
                  const hasDepreciation = yearData.totalDepreciation > 0;
                  
                  if (!hasDepreciation && index > 0) return null;
                  
                  return (
                    <tr key={yearData.year} style={{ background: index % 2 === 0 ? 'rgba(15,23,42,0.3)' : 'transparent' }}>
                      <td style={{ padding: '10px 16px', color: '#e2e8f0', fontWeight: '500' }}>{yearData.year}</td>
                      {ASSET_CATEGORIES.filter(cat => allocations[cat.id] > 0 && cat.life > 0).map(cat => (
                        <td key={cat.id} style={{ padding: '10px 16px', textAlign: 'right', color: yearData.depreciation[cat.id] > 0 ? '#e2e8f0' : '#475569' }}>
                          {yearData.depreciation[cat.id] > 0 ? formatCurrency(yearData.depreciation[cat.id]) : '—'}
                        </td>
                      ))}
                      <td style={{ padding: '10px 16px', textAlign: 'right', color: '#10b981', fontWeight: '600' }}>
                        {formatCurrency(yearData.totalDepreciation)}
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', color: '#64748b' }}>
                        {formatCurrency(cumulative)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary Tab */}
      {activeTab === 'summary' && (
        <div style={{ display: 'grid', gap: '24px' }}>
          {/* Key Metrics */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px'
          }}>
            {[
              { label: 'First Year Depreciation', value: summaryStats.firstYearTotal, color: '#10b981' },
              { label: '5-Year Total', value: summaryStats.fiveYearTotal, color: '#3b82f6' },
              { label: '10-Year Total', value: summaryStats.tenYearTotal, color: '#8b5cf6' },
              { label: 'Total Depreciable Basis', value: summaryStats.totalDepreciable, color: '#f59e0b' }
            ].map((metric, i) => (
              <div key={i} style={{
                background: 'rgba(30,41,59,0.6)',
                border: `1px solid ${metric.color}40`,
                borderRadius: '12px',
                padding: '20px'
              }}>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {metric.label}
                </div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: metric.color }}>
                  {formatCurrency(metric.value)}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  {((metric.value / totalCost) * 100).toFixed(1)}% of total cost
                </div>
              </div>
            ))}
          </div>

          {/* Category Breakdown */}
          <div style={{
            background: 'rgba(30,41,59,0.6)',
            border: '1px solid rgba(71,85,105,0.5)',
            borderRadius: '12px',
            padding: '24px'
          }}>
            <h2 style={{ margin: '0 0 20px', fontSize: '18px', color: '#e2e8f0' }}>Cost Segregation Breakdown</h2>
            <div style={{ display: 'grid', gap: '12px' }}>
              {ASSET_CATEGORIES.filter(cat => allocations[cat.id] > 0).map(cat => {
                const amount = (allocations[cat.id] / 100) * totalCost;
                const catData = scheduleData.categorySchedules[cat.id];
                const section179 = catData?.section179 || 0;
                const bonus = catData?.bonusDepreciation || 0;
                
                return (
                  <div key={cat.id} style={{
                    display: 'grid',
                    gridTemplateColumns: '200px 1fr 120px 120px 120px',
                    gap: '16px',
                    alignItems: 'center',
                    padding: '12px',
                    background: 'rgba(15,23,42,0.4)',
                    borderRadius: '8px',
                    borderLeft: `3px solid ${cat.color}`
                  }}>
                    <div>
                      <div style={{ fontWeight: '600', color: cat.color, fontSize: '14px' }}>{cat.name}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{cat.life > 0 ? `${cat.life} year life` : 'Non-depreciable'}</div>
                    </div>
                    <div style={{
                      height: '8px',
                      background: 'rgba(71,85,105,0.3)',
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${allocations[cat.id]}%`,
                        height: '100%',
                        background: cat.color,
                        borderRadius: '4px'
                      }} />
                    </div>
                    <div style={{ textAlign: 'right', color: '#e2e8f0', fontWeight: '600' }}>
                      {formatCurrency(amount)}
                    </div>
                    <div style={{ textAlign: 'right', color: '#94a3b8', fontSize: '13px' }}>
                      {allocations[cat.id]}%
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {section179 > 0 && <div style={{ fontSize: '11px', color: '#8b5cf6' }}>§179: {formatCurrency(section179)}</div>}
                      {bonus > 0 && <div style={{ fontSize: '11px', color: '#3b82f6' }}>Bonus: {formatCurrency(bonus)}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tax Impact Note */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(239,68,68,0.1))',
            border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: '12px',
            padding: '20px'
          }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <span style={{ fontSize: '24px' }}>⚠️</span>
              <div>
                <div style={{ fontWeight: '600', color: '#f59e0b', marginBottom: '8px' }}>Important Tax Considerations</div>
                <ul style={{ margin: 0, paddingLeft: '20px', color: '#94a3b8', fontSize: '13px', lineHeight: '1.8' }}>
                  <li>Cost segregation studies should be performed by qualified professionals (engineers, CPAs)</li>
                  <li>Accelerated depreciation may be subject to recapture upon sale</li>
                  <li>Section 179 deductions are limited by business income and phase-out thresholds</li>
                  <li>Bonus depreciation rates decrease annually (100% in 2022 → 0% by 2027)</li>
                  <li>Consult with a tax professional before making depreciation elections</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
