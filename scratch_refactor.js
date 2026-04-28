const fs = require('fs');
const file = 'frontend/src/pages/SpeedTestPage.jsx';
let content = fs.readFileSync(file, 'utf8');

const sStyles = '  const styles = {';
const sComp = '  // === COMPONENTE CARD ===';

let i1 = content.indexOf(sStyles);
let i2 = content.indexOf(sComp);

let stylesCodeRaw = content.substring(i1, i2);
content = content.substring(0, i1) + content.substring(i2);

let stylesCode = stylesCodeRaw.split('\n').map(l => l.startsWith('  ') ? l.substring(2) : l).join('\n');

const cRender = '  // === RENDER ===';
i2 = content.indexOf(cRender);
i1 = content.indexOf(sComp);

let cardCodeRaw = content.substring(i1, i2);
content = content.substring(0, i1) + content.substring(i2);

let cardCode = cardCodeRaw.replace(
  'const CompanyCard = ({ company }) => {',
  'const CompanyCard = React.memo(({ company, lastSeenNowMs, onOpenDetail, onToggle }) => {'
).replace(
  /const hasData = Boolean\(/,
  'const enabled = company.speedtest_enabled !== false;\n    const agentIdNum = resolveAgentIdFromRow(company);\n    const aziendaIdNum = resolveAziendaIdFromRow(company);\n    const canOpenDetail = agentIdNum != null || aziendaIdNum != null;\n\n    const hasData = Boolean('
).replace(
  /    const openDetail = \(\) => \{[\s\S]*?\n    \};\n/,
  '    const openDetail = () => {\n      if (!canOpenDetail) return;\n      onOpenDetail(company, agentIdNum, aziendaIdNum);\n    };\n'
).replace(
  /toggleSpeedTest\(aid, !enabled, e\);/,
  'onToggle(aid, !enabled, e);'
).replace(/\n  \};\n$/, '\n  });\n');

const helpersStart = '  // === Helpers ===\n  const formatDate = (';
const historyEnd = '    [historyFiltered]\n  );\n';
i1 = content.indexOf(helpersStart);
let h2 = content.indexOf(historyEnd);
i2 = content.indexOf('\n', h2) + 1;

let helpersCodeRaw = content.substring(i1, i2);
let helpersExtract = helpersCodeRaw.replace(/  const historyTableRows[\s\S]*?\n  \);\n/, '');
content = content.replace(helpersExtract, '');
let helpersCode = helpersExtract.split('\n').map(l => l.startsWith('  ') ? l.substring(2) : l).join('\n');

const injectIndex = content.indexOf('const SpeedTestPage = ({');

const newUsage = `<CompanyCard 
              key={speedtestRowKey(company)} 
              company={company} 
              lastSeenNowMs={lastSeenNowMs}
              onOpenDetail={(comp, aId, azId) => {
                const snapshot = comp.test_date != null && comp.ping_ms != null && !Number.isNaN(Number(comp.ping_ms)) ? { ...comp } : null;
                setSelectedCompany({
                  agentId: aId,
                  aziendaId: azId,
                  aziendaName: comp.azienda_name || comp.aziendaName || comp.agent_name || 'Agent',
                  snapshot,
                  lastHeartbeatFromOverview: comp.last_heartbeat ?? comp.lastHeartbeat ?? null,
                  download_vs_hist_pct: comp.download_vs_hist_pct ?? comp.downloadVsHistPct ?? null,
                  upload_vs_hist_pct: comp.upload_vs_hist_pct ?? comp.uploadVsHistPct ?? null,
                  public_ip_stability: comp.public_ip_stability ?? comp.publicIpStability ?? null
                });
                window.requestAnimationFrame(() => {
                  try { if (pageScrollRef.current) pageScrollRef.current.scrollTop = 0; } catch {}
                });
              }}
              onToggle={(aid, enabled, e) => toggleSpeedTest(aid, enabled, e)}
            />`;

content = content.replace(/<CompanyCard key=\{speedtestRowKey\(company\)\} company=\{company\} \/>/g, newUsage);
content = content.replace(/<CompanyCard key=\{speedtestRowKey\(company\) \|\| idx\} company=\{company\} \/>/g, newUsage);

content = content.substring(0, injectIndex) + 
  `// === EXTRACTED HELPERS ===\n${helpersCode}\n\n// === STYLES ===\n${stylesCode}\n\n${cardCode}\n\n` + 
  content.substring(injectIndex);

fs.writeFileSync(file, content);
console.log("Done");
