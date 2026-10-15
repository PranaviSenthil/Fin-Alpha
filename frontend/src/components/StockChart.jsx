import React, { useState, useRef, useEffect } from 'react';

export default function StockChart({ bars = [], indicators = {}, symbol = '', initialPeriod = '1mo' }) {
  const [chartType, setChartType] = useState('candlestick'); // 'candlestick' | 'line'
  const [activeIndicators, setActiveIndicators] = useState({
    sma20: true,
    sma50: false,
    ema20: false,
    bollinger: false,
    rsi: false,
    macd: false
  });

  const canvasRef = useRef(null);
  const [hoverData, setHoverData] = useState(null);

  const toggleIndicator = (key) => {
    setActiveIndicators((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bars || bars.length === 0) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Layout partitions
    const hasSubChart = activeIndicators.rsi || activeIndicators.macd;
    const mainHeight = hasSubChart ? height * 0.65 : height * 0.78;
    const subHeight = hasSubChart ? height * 0.22 : 0;
    const volumeHeight = hasSubChart ? height * 0.10 : height * 0.18;
    const mainBottom = mainHeight;
    const paddingLeft = 10;
    const paddingRight = 60;
    const paddingTop = 20;

    ctx.clearRect(0, 0, width, height);

    // Find price bounds
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let maxVolume = 0;

    bars.forEach((b) => {
      if (b.low < minPrice) minPrice = b.low;
      if (b.high > maxPrice) maxPrice = b.high;
      if (b.volume > maxVolume) maxVolume = b.volume;
    });

    // Expand margin slightly
    const priceRange = maxPrice - minPrice || 1;
    minPrice -= priceRange * 0.05;
    maxPrice += priceRange * 0.05;
    const finalRange = maxPrice - minPrice;

    const plotWidth = width - paddingLeft - paddingRight;
    const barWidth = Math.max(2, (plotWidth / bars.length) * 0.7);
    const spacing = plotWidth / bars.length;

    const getX = (i) => paddingLeft + i * spacing + spacing / 2;
    const getY = (p) => paddingTop + (1 - (p - minPrice) / finalRange) * (mainHeight - paddingTop);

    // Draw Price Grid lines
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748b';
    ctx.font = '10px Inter, monospace';
    ctx.textAlign = 'left';

    const gridSteps = 5;
    for (let i = 0; i <= gridSteps; i++) {
      const p = minPrice + (finalRange / gridSteps) * i;
      const y = getY(p);
      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(width - paddingRight, y);
      ctx.stroke();
      ctx.fillText(`₹${p.toFixed(1)}`, width - paddingRight + 6, y + 3);
    }

    // 1. Draw Volume Bars
    const volBaseY = mainBottom + volumeHeight;
    bars.forEach((b, i) => {
      const x = getX(i);
      const volH = maxVolume > 0 ? (b.volume / maxVolume) * volumeHeight : 0;
      const isUp = b.close >= b.open;
      ctx.fillStyle = isUp ? 'rgba(5, 150, 105, 0.25)' : 'rgba(220, 38, 38, 0.25)';
      ctx.fillRect(x - barWidth / 2, volBaseY - volH, barWidth, volH);
    });

    // 2. Draw Candlesticks or Line
    if (chartType === 'candlestick') {
      bars.forEach((b, i) => {
        const x = getX(i);
        const yOpen = getY(b.open);
        const yClose = getY(b.close);
        const yHigh = getY(b.high);
        const yLow = getY(b.low);
        const isUp = b.close >= b.open;
        const color = isUp ? '#059669' : '#dc2626';

        // High-Low Wick
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x, yHigh);
        ctx.lineTo(x, yLow);
        ctx.stroke();

        // Candle Body
        const top = Math.min(yOpen, yClose);
        const candleH = Math.max(2, Math.abs(yClose - yOpen));
        ctx.fillStyle = color;
        ctx.fillRect(x - barWidth / 2, top, barWidth, candleH);
      });
    } else {
      // Line Chart
      ctx.beginPath();
      bars.forEach((b, i) => {
        const x = getX(i);
        const y = getY(b.close);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Area gradient fill
      const grad = ctx.createLinearGradient(0, paddingTop, 0, mainBottom);
      grad.addColorStop(0, 'rgba(37, 99, 235, 0.22)');
      grad.addColorStop(1, 'rgba(37, 99, 235, 0.0)');
      ctx.lineTo(getX(bars.length - 1), mainBottom);
      ctx.lineTo(getX(0), mainBottom);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // 3. Draw Indicators Overlay on Price
    const indData = indicators?.bars_with_indicators || [];

    // Helper to draw indicator line
    const drawIndLine = (key, color, width = 1.5) => {
      ctx.beginPath();
      let started = false;
      indData.forEach((d, i) => {
        const val = d[key];
        if (val !== null && val !== undefined) {
          const x = getX(i);
          const y = getY(val);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
    };

    if (activeIndicators.sma20) drawIndLine('sma20', '#d97706', 1.5);
    if (activeIndicators.sma50) drawIndLine('sma50', '#8b5cf6', 1.5);
    if (activeIndicators.ema20) drawIndLine('ema20', '#0284c7', 1.5);
    if (activeIndicators.bollinger) {
      drawIndLine('bb_upper', 'rgba(217, 119, 6, 0.7)', 1);
      drawIndLine('bb_middle', 'rgba(217, 119, 6, 0.4)', 1);
      drawIndLine('bb_lower', 'rgba(217, 119, 6, 0.7)', 1);
    }

    // 4. Draw Subchart (RSI or MACD)
    if (hasSubChart) {
      const subTop = height - subHeight;
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(paddingLeft, subTop);
      ctx.lineTo(width - paddingRight, subTop);
      ctx.stroke();

      if (activeIndicators.rsi) {
        // RSI 0-100 chart
        const getRsiY = (v) => subTop + (1 - v / 100) * subHeight;
        
        // Draw 30 / 70 threshold lines
        ctx.strokeStyle = 'rgba(220, 38, 38, 0.35)';
        ctx.beginPath();
        ctx.moveTo(paddingLeft, getRsiY(70));
        ctx.lineTo(width - paddingRight, getRsiY(70));
        ctx.stroke();
        ctx.fillText('70', width - paddingRight + 6, getRsiY(70) + 3);

        ctx.strokeStyle = 'rgba(5, 150, 105, 0.35)';
        ctx.beginPath();
        ctx.moveTo(paddingLeft, getRsiY(30));
        ctx.lineTo(width - paddingRight, getRsiY(30));
        ctx.stroke();
        ctx.fillText('30', width - paddingRight + 6, getRsiY(30) + 3);

        // Draw RSI line
        ctx.beginPath();
        let rsiStarted = false;
        indData.forEach((d, i) => {
          if (d.rsi14 !== null && d.rsi14 !== undefined) {
            const x = getX(i);
            const y = getRsiY(d.rsi14);
            if (!rsiStarted) {
              ctx.moveTo(x, y);
              rsiStarted = true;
            } else {
              ctx.lineTo(x, y);
            }
          }
        });
        ctx.strokeStyle = '#ec4899';
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.fillStyle = '#ec4899';
        ctx.fillText('RSI (14)', paddingLeft + 5, subTop + 14);
      } else if (activeIndicators.macd) {
        // MACD histogram and line
        ctx.fillStyle = '#a855f7';
        ctx.fillText('MACD (12, 26, 9)', paddingLeft + 5, subTop + 14);
      }
    }

  }, [bars, indicators, chartType, activeIndicators]);

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !bars.length) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const paddingLeft = 10;
    const paddingRight = 60;
    const plotWidth = canvas.clientWidth - paddingLeft - paddingRight;
    const idx = Math.floor(((x - paddingLeft) / plotWidth) * bars.length);
    if (idx >= 0 && idx < bars.length) {
      setHoverData({
        ...bars[idx],
        index: idx,
        indicators: indicators?.bars_with_indicators?.[idx]
      });
    }
  };

  const handleMouseLeave = () => {
    setHoverData(null);
  };

  const latestBar = bars[bars.length - 1];
  const displayBar = hoverData || latestBar;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '10px' }}>
      {/* Chart Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            className={`btn btn-secondary ${chartType === 'candlestick' ? 'badge-fresh' : ''}`}
            onClick={() => setChartType('candlestick')}
            style={{ fontSize: '0.75rem', padding: '4px 10px' }}
          >
            Candlestick
          </button>
          <button
            className={`btn btn-secondary ${chartType === 'line' ? 'badge-fresh' : ''}`}
            onClick={() => setChartType('line')}
            style={{ fontSize: '0.75rem', padding: '4px 10px' }}
          >
            Line
          </button>
        </div>

        {/* Indicators Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Indicators:</span>
          <button
            onClick={() => toggleIndicator('sma20')}
            className={`badge ${activeIndicators.sma20 ? 'bg-gain' : 'badge-outline'}`}
            style={{ cursor: 'pointer' }}
          >
            SMA 20
          </button>
          <button
            onClick={() => toggleIndicator('sma50')}
            className={`badge ${activeIndicators.sma50 ? 'badge-fresh' : 'badge-outline'}`}
            style={{ cursor: 'pointer' }}
          >
            SMA 50
          </button>
          <button
            onClick={() => toggleIndicator('ema20')}
            className={`badge ${activeIndicators.ema20 ? 'badge-fresh' : 'badge-outline'}`}
            style={{ cursor: 'pointer' }}
          >
            EMA 20
          </button>
          <button
            onClick={() => toggleIndicator('bollinger')}
            className={`badge ${activeIndicators.bollinger ? 'badge-fresh' : 'badge-outline'}`}
            style={{ cursor: 'pointer' }}
          >
            Bollinger
          </button>
          <button
            onClick={() => toggleIndicator('rsi')}
            className={`badge ${activeIndicators.rsi ? 'badge-fresh' : 'badge-outline'}`}
            style={{ cursor: 'pointer' }}
          >
            RSI
          </button>
        </div>
      </div>

      {/* Hover Info Strip */}
      {displayBar && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '4px 0' }}>
          <span><strong style={{ color: 'var(--text-muted)' }}>Date:</strong> {displayBar.timestamp?.slice(0, 10)}</span>
          <span><strong style={{ color: 'var(--text-muted)' }}>O:</strong> ₹{displayBar.open}</span>
          <span><strong style={{ color: 'var(--text-muted)' }}>H:</strong> ₹{displayBar.high}</span>
          <span><strong style={{ color: 'var(--text-muted)' }}>L:</strong> ₹{displayBar.low}</span>
          <span><strong style={{ color: 'var(--text-muted)' }}>C:</strong> <span style={{ color: displayBar.close >= displayBar.open ? 'var(--gain-color)' : 'var(--loss-color)', fontWeight: 600 }}>₹{displayBar.close}</span></span>
          <span><strong style={{ color: 'var(--text-muted)' }}>Vol:</strong> {displayBar.volume?.toLocaleString()}</span>
          {displayBar.indicators?.rsi14 && (
            <span><strong style={{ color: '#ec4899' }}>RSI:</strong> {displayBar.indicators.rsi14}</span>
          )}
        </div>
      )}

      {/* Main Canvas */}
      <div style={{ position: 'relative', width: '100%', height: '380px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
      </div>
    </div>
  );
}
