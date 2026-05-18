export function renderDashboard(basePath: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>API Analytics</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; }
  .header { padding: 24px 32px; border-bottom: 1px solid #1e293b; display: flex; align-items: center; justify-content: space-between; }
  .header h1 { font-size: 20px; font-weight: 600; }
  .header h1 span { color: #38bdf8; }
  .header select { background: #1e293b; color: #e2e8f0; border: 1px solid #334155; border-radius: 8px; padding: 8px 12px; font-size: 14px; cursor: pointer; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; padding: 24px 32px; }
  .card { background: #1e293b; border-radius: 12px; padding: 20px; }
  .card .label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 8px; }
  .card .value { font-size: 28px; font-weight: 700; }
  .card .value.green { color: #4ade80; }
  .card .value.blue { color: #38bdf8; }
  .card .value.red { color: #f87171; }
  .card .value.amber { color: #fbbf24; }
  .charts { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; padding: 0 32px 24px; }
  .chart-card { background: #1e293b; border-radius: 12px; padding: 20px; }
  .chart-card h3 { font-size: 14px; font-weight: 600; color: #94a3b8; margin-bottom: 16px; }
  .section-header { display: flex; align-items: center; gap: 12px; }
  .section-header h3 { margin-bottom: 0; }
  .section-header select { background: #1e293b; color: #e2e8f0; border: 1px solid #334155; border-radius: 6px; padding: 4px 8px; font-size: 12px; cursor: pointer; }
  .table-section { padding: 0 32px 32px; }
  .table-section h3 { font-size: 14px; font-weight: 600; color: #94a3b8; margin-bottom: 12px; }
  .insight-section { padding: 0 32px 32px; }
  .insight-section h3 { font-size: 14px; font-weight: 600; color: #94a3b8; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 12px; overflow: hidden; }
  th { text-align: left; padding: 12px 16px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; background: #0f172a; }
  td { padding: 10px 16px; font-size: 13px; border-top: 1px solid #0f172a; }
  .method { font-weight: 600; font-size: 11px; padding: 2px 8px; border-radius: 4px; }
  .method.GET { background: #164e63; color: #22d3ee; }
  .method.POST { background: #3b0764; color: #c084fc; }
  .method.PUT { background: #422006; color: #fbbf24; }
  .method.PATCH { background: #1a2e05; color: #a3e635; }
  .method.DELETE { background: #450a0a; color: #f87171; }
  .status { font-weight: 600; }
  .status.s2 { color: #4ade80; }
  .status.s3 { color: #38bdf8; }
  .status.s4 { color: #fbbf24; }
  .status.s5 { color: #f87171; }
  .bar { height: 6px; border-radius: 3px; background: #334155; margin-top: 4px; }
  .bar-fill { height: 100%; border-radius: 3px; background: #38bdf8; }
  .tag-badge { display: inline-block; font-size: 11px; font-weight: 600; padding: 2px 10px; border-radius: 4px; background: #1e3a5f; color: #7dd3fc; }
  .refresh { font-size: 12px; color: #64748b; }
  .empty-state { text-align: center; color: #64748b; padding: 32px; font-size: 13px; }
  @media (max-width: 768px) { .charts { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<div class="header">
  <h1><span>&#9679;</span> API Analytics</h1>
  <div style="display:flex;align-items:center;gap:12px">
    <span class="refresh" id="lastUpdate"></span>
    <select id="timeRange" onchange="load()">
      <option value="1">Last hour</option>
      <option value="6">Last 6 hours</option>
      <option value="24" selected>Last 24 hours</option>
      <option value="168">Last 7 days</option>
      <option value="720">Last 30 days</option>
    </select>
  </div>
</div>

<div class="grid" id="stats"></div>

<div class="charts">
  <div class="chart-card">
    <h3>Requests over time</h3>
    <canvas id="timeChart"></canvas>
  </div>
  <div class="chart-card">
    <h3>Status codes</h3>
    <canvas id="statusChart"></canvas>
  </div>
</div>

<div id="insightsContainer"></div>

<div class="table-section">
  <h3>Top endpoints</h3>
  <table id="endpointsTable"></table>
</div>

<div class="table-section">
  <h3>Slowest endpoints</h3>
  <table id="slowTable"></table>
</div>

<div class="table-section">
  <h3>Recent errors</h3>
  <table id="errorsTable"></table>
</div>

<script>
const BASE = '${basePath}';
let timeChart, statusChart, insightChart;
let tagKeys = [];
let activeTag = null;

async function load() {
  const hours = document.getElementById('timeRange').value;
  const [overview, timeseries, errors, tags] = await Promise.all([
    fetch(BASE + '/api/overview?hours=' + hours).then(r => r.json()),
    fetch(BASE + '/api/timeseries?hours=' + hours).then(r => r.json()),
    fetch(BASE + '/api/errors').then(r => r.json()),
    fetch(BASE + '/api/tags').then(r => r.json()),
  ]);

  document.getElementById('lastUpdate').textContent = 'Updated ' + new Date().toLocaleTimeString();

  const t = overview.totals;
  document.getElementById('stats').innerHTML =
    stat('Total requests', t.totalRequests, 'blue') +
    stat('Avg response', t.avgResponseTime + ' ms', 'green') +
    stat('Max response', t.maxResponseTime + ' ms', 'amber') +
    stat('Errors', t.errorCount, t.errorCount > 0 ? 'red' : 'green') +
    stat('Error rate', t.totalRequests ? ((t.errorCount/t.totalRequests)*100).toFixed(1) + '%' : '0%', t.errorCount > 0 ? 'red' : 'green');

  renderTimeChart(timeseries);
  renderStatusChart(overview.byStatus);
  renderEndpoints(overview.topEndpoints);
  renderSlow(overview.slowEndpoints);
  renderErrors(errors);

  tagKeys = tags;
  if (tags.length > 0) {
    if (!activeTag) activeTag = tags[0];
    renderInsightsSection(tags);
    loadInsight();
  } else {
    document.getElementById('insightsContainer').innerHTML = '';
  }
}

function stat(label, value, color) {
  return '<div class="card"><div class="label">' + label + '</div><div class="value ' + color + '">' + value + '</div></div>';
}

function renderInsightsSection(tags) {
  const container = document.getElementById('insightsContainer');
  const options = tags.map(t => '<option value="' + t + '"' + (t === activeTag ? ' selected' : '') + '>' + t + '</option>').join('');

  container.innerHTML =
    '<div class="insight-section">' +
      '<div class="section-header" style="margin-bottom:16px">' +
        '<h3>Custom Insights</h3>' +
        '<select id="tagSelect" onchange="switchTag(this.value)">' + options + '</select>' +
      '</div>' +
      '<div class="charts" style="padding:0;margin-bottom:16px">' +
        '<div class="chart-card"><h3>Requests by <span id="insightLabel">' + activeTag + '</span></h3><canvas id="insightBarChart"></canvas></div>' +
        '<div class="chart-card"><h3>Timeline by <span id="insightTimeLabel">' + activeTag + '</span></h3><canvas id="insightTimeChart"></canvas></div>' +
      '</div>' +
      '<table id="insightTable"></table>' +
    '</div>';
}

function switchTag(tag) {
  activeTag = tag;
  document.getElementById('insightLabel').textContent = tag;
  document.getElementById('insightTimeLabel').textContent = tag;
  loadInsight();
}

let insightBarChart, insightTimeChart;

async function loadInsight() {
  if (!activeTag) return;
  const hours = document.getElementById('timeRange').value;
  const [data, timeseries] = await Promise.all([
    fetch(BASE + '/api/insights?tag=' + activeTag + '&hours=' + hours).then(r => r.json()),
    fetch(BASE + '/api/tag-timeseries?tag=' + activeTag + '&hours=' + hours).then(r => r.json()),
  ]);

  // Bar chart
  const barCanvas = document.getElementById('insightBarChart');
  if (barCanvas) {
    const palette = ['#38bdf8','#4ade80','#fbbf24','#f87171','#c084fc','#fb923c','#22d3ee','#a3e635','#e879f9','#f472b6'];
    const labels = data.map(d => d.tagValue || '(empty)');
    const counts = data.map(d => d.count);
    const colors = labels.map((_, i) => palette[i % palette.length]);

    if (insightBarChart) insightBarChart.destroy();
    insightBarChart = new Chart(barCanvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ label: 'Requests', data: counts, backgroundColor: colors, borderRadius: 4 }]
      },
      options: {
        responsive: true,
        indexAxis: labels.length > 8 ? 'y' : 'x',
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#64748b' }, grid: { color: '#1e293b' } },
          y: { ticks: { color: '#64748b' }, grid: { color: '#1e293b' }, beginAtZero: true }
        }
      }
    });
  }

  // Timeseries by tag
  const timeCanvas = document.getElementById('insightTimeChart');
  if (timeCanvas && timeseries.length > 0) {
    const tagValues = [...new Set(timeseries.map(d => d.tagValue))];
    const buckets = [...new Set(timeseries.map(d => d.bucket))].sort();
    const palette = ['#38bdf8','#4ade80','#fbbf24','#f87171','#c084fc','#fb923c','#22d3ee','#a3e635'];
    const datasets = tagValues.map((tv, i) => {
      const byBucket = {};
      timeseries.filter(d => d.tagValue === tv).forEach(d => byBucket[d.bucket] = d.count);
      return {
        label: tv || '(empty)',
        data: buckets.map(b => byBucket[b] || 0),
        borderColor: palette[i % palette.length],
        backgroundColor: palette[i % palette.length] + '22',
        fill: false,
        tension: 0.3,
      };
    });
    const timeLabels = buckets.map(b => {
      const dt = new Date(b);
      return dt.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    });

    if (insightTimeChart) insightTimeChart.destroy();
    insightTimeChart = new Chart(timeCanvas, {
      type: 'line',
      data: { labels: timeLabels, datasets },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: '#94a3b8' } } },
        scales: {
          x: { ticks: { color: '#64748b', maxTicksLimit: 12 }, grid: { color: '#1e293b' } },
          y: { ticks: { color: '#64748b' }, grid: { color: '#1e293b' }, beginAtZero: true }
        }
      }
    });
  }

  // Table
  const table = document.getElementById('insightTable');
  if (table) {
    if (data.length === 0) {
      table.innerHTML = '<tr><td class="empty-state">No data with tag "' + activeTag + '" found</td></tr>';
      return;
    }
    const max = Math.max(...data.map(d => d.count), 1);
    let html = '<thead><tr><th>' + activeTag + '</th><th>Requests</th><th>Avg</th><th>Max</th><th>Errors</th><th>Error %</th><th></th></tr></thead><tbody>';
    data.forEach(d => {
      const errPct = d.count ? ((d.errors/d.count)*100).toFixed(1) : '0.0';
      html += '<tr><td><span class="tag-badge">' + (d.tagValue || '(empty)') + '</span></td><td>' + d.count + '</td><td>' + d.avgTime + ' ms</td><td>' + d.maxTime + ' ms</td><td class="' + (d.errors > 0 ? 'status s4' : '') + '">' + d.errors + '</td><td class="' + (parseFloat(errPct) > 0 ? 'status s4' : '') + '">' + errPct + '%</td><td style="width:120px"><div class="bar"><div class="bar-fill" style="width:' + (d.count/max*100) + '%"></div></div></td></tr>';
    });
    html += '</tbody>';
    table.innerHTML = html;
  }
}

function renderTimeChart(data) {
  const labels = data.map(d => {
    const dt = new Date(d.bucket);
    return dt.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  });
  const config = {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Requests', data: data.map(d => d.count), borderColor: '#38bdf8', backgroundColor: 'rgba(56,189,248,0.1)', fill: true, tension: 0.3 },
        { label: 'Errors', data: data.map(d => d.errors), borderColor: '#f87171', backgroundColor: 'rgba(248,113,113,0.1)', fill: true, tension: 0.3 }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: '#94a3b8' } } },
      scales: {
        x: { ticks: { color: '#64748b', maxTicksLimit: 12 }, grid: { color: '#1e293b' } },
        y: { ticks: { color: '#64748b' }, grid: { color: '#1e293b' }, beginAtZero: true }
      }
    }
  };
  if (timeChart) timeChart.destroy();
  timeChart = new Chart(document.getElementById('timeChart'), config);
}

function renderStatusChart(data) {
  const colors = { '2xx': '#4ade80', '3xx': '#38bdf8', '4xx': '#fbbf24', '5xx': '#f87171' };
  const config = {
    type: 'doughnut',
    data: {
      labels: data.map(d => d.statusGroup),
      datasets: [{ data: data.map(d => d.count), backgroundColor: data.map(d => colors[d.statusGroup] || '#64748b') }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 16 } } }
    }
  };
  if (statusChart) statusChart.destroy();
  statusChart = new Chart(document.getElementById('statusChart'), config);
}

function renderEndpoints(data) {
  const max = Math.max(...data.map(d => d.count), 1);
  let html = '<thead><tr><th>Method</th><th>Path</th><th>Requests</th><th>Avg</th><th>Max</th><th></th></tr></thead><tbody>';
  data.forEach(d => {
    html += '<tr><td><span class="method ' + d.method + '">' + d.method + '</span></td><td>' + d.path + '</td><td>' + d.count + '</td><td>' + d.avgTime + ' ms</td><td>' + d.maxTime + ' ms</td><td style="width:120px"><div class="bar"><div class="bar-fill" style="width:' + (d.count/max*100) + '%"></div></div></td></tr>';
  });
  html += '</tbody>';
  document.getElementById('endpointsTable').innerHTML = html;
}

function renderSlow(data) {
  const max = Math.max(...data.map(d => d.avgTime), 1);
  let html = '<thead><tr><th>Method</th><th>Path</th><th>Requests</th><th>Avg</th><th>Max</th><th></th></tr></thead><tbody>';
  data.forEach(d => {
    html += '<tr><td><span class="method ' + d.method + '">' + d.method + '</span></td><td>' + d.path + '</td><td>' + d.count + '</td><td>' + d.avgTime + ' ms</td><td>' + d.maxTime + ' ms</td><td style="width:120px"><div class="bar"><div class="bar-fill" style="width:' + (d.avgTime/max*100) + '%;background:#fbbf24"></div></div></td></tr>';
  });
  html += '</tbody>';
  document.getElementById('slowTable').innerHTML = html;
}

function renderErrors(data) {
  let html = '<thead><tr><th>Time</th><th>Method</th><th>Path</th><th>Status</th><th>Response</th></tr></thead><tbody>';
  if (data.length === 0) html += '<tr><td colspan="5" style="text-align:center;color:#64748b;padding:24px">No errors</td></tr>';
  data.forEach(d => {
    const sc = d.status >= 500 ? 's5' : 's4';
    html += '<tr><td>' + new Date(d.timestamp).toLocaleString() + '</td><td><span class="method ' + d.method + '">' + d.method + '</span></td><td>' + d.path + '</td><td><span class="status ' + sc + '">' + d.status + '</span></td><td>' + d.response_time + ' ms</td></tr>';
  });
  html += '</tbody>';
  document.getElementById('errorsTable').innerHTML = html;
}

load();
setInterval(load, 30000);
</script>
</body>
</html>`;
}
